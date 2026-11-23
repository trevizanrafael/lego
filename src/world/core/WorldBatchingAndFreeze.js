/**
 * WorldBatchingAndFreeze.js
 * Batching espacial de calçadas e árvores instanciadas, construtores auxiliares de quadras/prédios,
 * feixe 3D de waypoint, setup inicial noturno de céu/luzes e congelamento de matrizes estáticas.
 */

import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick, getLegoMaterial, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import {
  buildDetailedBuilding, makeFastBox, flushSpatialChunkedBuckets,
  mergeBufferGeometries, mergeColoredGeometries, optimizeStaticGroupMeshes
} from '../BuildingGenerator.js';
import { createLegoCarMesh } from '../StreetPropsBuilder.js';
import { buildUrbanDowntownBlock } from '../regions/DowntownBuilder.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from '../MetroSystemBuilder.js';
import { IS_SCALED_WORLD, ROAD, ws, fromWs } from './WorldLayoutScale.js';
import { getScaledUrbanCurbLiftAt } from '../terrain/UrbanSidewalkAndBlockBuilder.js';
import { collectProtectedDynamicMaterials } from '../../graphics/MaterialRegistry.js';

const _WHITE_COL = new THREE.Color(0xffffff);
const _NORM_M3 = new THREE.Matrix3();
let _sharedLooseStdVcMat = null, _sharedLooseStdOffsetVcMat = null, _sharedLooseBasicVcMat = null, _sharedLooseBasicOffsetVcMat = null;

function getVcCellSpan(x, z, coreSpan) {
  if (Math.abs(x) > 4500 || Math.abs(z) > 4500) return 11000;
  if (Math.abs(x) > 1700 || Math.abs(z) > 1950) return 4400;
  return coreSpan;
}

function buildCoarseVcLodGeo(srcGeo, minDoubleAreaSq = 900) {
  const pos = srcGeo.attributes.position, norm = srcGeo.attributes.normal, col = srcGeo.attributes.color;
  if (!pos || !norm || !col) return null;
  const idx = srcGeo.index ? srcGeo.index.array : null;
  const triCount = idx ? Math.floor(idx.length / 3) : Math.floor(pos.count / 3);
  if (triCount < 3200) return null;

  const pSrc = pos.array, nSrc = norm.array, cSrc = col.array;
  const kept = new Int32Array(triCount * 3);
  const filterPass = (thresh) => {
    let len = 0;
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      if (nSrc[i0 * 3 + 1] < -0.85 && pSrc[i0 * 3 + 1] < 25) continue;
      const x0 = pSrc[i0 * 3], y0 = pSrc[i0 * 3 + 1], z0 = pSrc[i0 * 3 + 2];
      const ax = pSrc[i1 * 3] - x0, ay = pSrc[i1 * 3 + 1] - y0, az = pSrc[i1 * 3 + 2] - z0;
      const bx = pSrc[i2 * 3] - x0, by = pSrc[i2 * 3 + 1] - y0, bz = pSrc[i2 * 3 + 2] - z0;
      const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
      if (cx * cx + cy * cy + cz * cz >= thresh) { kept[len++] = i0; kept[len++] = i1; kept[len++] = i2; }
    }
    return len;
  };
  let kLen = filterPass(minDoubleAreaSq);
  if (kLen === 0) kLen = filterPass(minDoubleAreaSq * 0.15);
  if (kLen === 0 || kLen > triCount * 3 * 0.76) return null;

  const remap = new Int32Array(pos.count).fill(-1), used = [];
  const outIdx = pos.count > 65535 ? new Uint32Array(kLen) : new Uint16Array(kLen);
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

function sliceWideVcGeoToCells(srcGeo, worldMat4, fallbackCol, cellSize) {
  if (!srcGeo.attributes.normal) srcGeo.computeVertexNormals();
  const pos = srcGeo.attributes.position, norm = srcGeo.attributes.normal, col = srcGeo.attributes.color;
  const vTotal = pos.count, pSrc = pos.array, nSrc = norm.array, cArr = col ? col.array : null;
  const e = worldMat4.elements, m00 = e[0], m01 = e[4], m02 = e[8], tx = e[12], m10 = e[1], m11 = e[5], m12 = e[9], ty = e[13], m20 = e[2], m21 = e[6], m22 = e[10], tz = e[14];
  _NORM_M3.getNormalMatrix(worldMat4);
  const ne = _NORM_M3.elements, n00 = ne[0], n01 = ne[3], n02 = ne[6], n10 = ne[1], n11 = ne[4], n12 = ne[7], n20 = ne[2], n21 = ne[5], n22 = ne[8];
  const pArr = new Float32Array(vTotal * 3), nArr = new Float32Array(vTotal * 3);
  for (let i = 0; i < vTotal; i++) {
    const s = i * 3, x = pSrc[s], y = pSrc[s + 1], z = pSrc[s + 2], nx = nSrc[s], ny = nSrc[s + 1], nz = nSrc[s + 2];
    pArr[s] = m00 * x + m01 * y + m02 * z + tx; pArr[s + 1] = m10 * x + m11 * y + m12 * z + ty; pArr[s + 2] = m20 * x + m21 * y + m22 * z + tz;
    const rx = n00 * nx + n01 * ny + n02 * nz, ry = n10 * nx + n11 * ny + n12 * nz, rz = n20 * nx + n21 * ny + n22 * nz;
    const inv = 1 / (Math.hypot(rx, ry, rz) || 1);
    nArr[s] = rx * inv; nArr[s + 1] = ry * inv; nArr[s + 2] = rz * inv;
  }

  const idx = srcGeo.index ? srcGeo.index.array : null;
  const triCount = idx ? Math.floor(idx.length / 3) : Math.floor(vTotal / 3);
  const cr = fallbackCol.r, cg = fallbackCol.g, cb = fallbackCol.b;
  const cellTris = new Map();
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const x0 = pArr[i0 * 3], z0 = pArr[i0 * 3 + 2], x1 = pArr[i1 * 3], z1 = pArr[i1 * 3 + 2], x2 = pArr[i2 * 3], z2 = pArr[i2 * 3 + 2];
    const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2), minZ = Math.min(z0, z1, z2), maxZ = Math.max(z0, z1, z2);
    const mx = (minX + maxX) * 0.5, mz = (minZ + maxZ) * 0.5;
    const cs = getVcCellSpan(mx, mz, cellSize);
    const key = `${cs}:${Math.floor(mx / cs)},${Math.floor(mz / cs)}`;
    let list = cellTris.get(key);
    if (!list) { list = []; cellTris.set(key, list); }
    list.push(i0, i1, i2);
  }

  const slices = [], remap = new Int32Array(vTotal).fill(-1), touched = [];
  for (const [cKey, tris] of cellTris.entries()) {
    touched.length = 0;
    const outIdx = tris.length > 65535 ? new Uint32Array(tris.length) : new Uint16Array(tris.length);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < tris.length; i++) {
      const oVi = tris[i];
      let nVi = remap[oVi];
      if (nVi === -1) {
        nVi = touched.length; remap[oVi] = nVi; touched.push(oVi);
        const vx = pArr[oVi * 3], vy = pArr[oVi * 3 + 1], vz = pArr[oVi * 3 + 2];
        if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
        if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
      }
      outIdx[i] = nVi;
    }
    const vc = touched.length, pOut = new Float32Array(vc * 3), nOut = new Float32Array(vc * 3), cOut = new Float32Array(vc * 3);
    for (let k = 0; k < vc; k++) {
      const vi = touched[k], s = vi * 3, d = k * 3;
      remap[vi] = -1;
      pOut[d] = pArr[s]; pOut[d + 1] = pArr[s + 1]; pOut[d + 2] = pArr[s + 2];
      nOut[d] = nArr[s]; nOut[d + 1] = nArr[s + 1]; nOut[d + 2] = nArr[s + 2];
      if (cArr) { cOut[d] = cArr[s]; cOut[d + 1] = cArr[s + 1]; cOut[d + 2] = cArr[s + 2]; }
      else { cOut[d] = cr; cOut[d + 1] = cg; cOut[d + 2] = cb; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pOut, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nOut, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cOut, 3));
    g.setIndex(new THREE.BufferAttribute(outIdx, 1));
    slices.push({ cKey, geo: g, minX, maxX, minY, maxY, minZ, maxZ });
  }
  return slices;
}

function getSharedLooseStdVcMaterial(withPolygonOffset = false) {
  if (withPolygonOffset) {
    if (!_sharedLooseStdOffsetVcMat) {
      _sharedLooseStdOffsetVcMat = markAsSharedAsset(new THREE.MeshStandardMaterial({
        color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.12,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
      }));
    }
    return _sharedLooseStdOffsetVcMat;
  }
  if (!_sharedLooseStdVcMat) {
    _sharedLooseStdVcMat = markAsSharedAsset(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.12 }));
  }
  return _sharedLooseStdVcMat;
}

function extractSignSliceGeo(srcGeo, idxStart, idxCount, worldMat4) {
  const pos = srcGeo.attributes.position, norm = srcGeo.attributes.normal, uv = srcGeo.attributes.uv, srcIdx = srcGeo.index?.array;
  if (!pos || !srcIdx || srcIdx.length < idxStart + idxCount) return null;
  const remap = new Int32Array(pos.count).fill(-1), usedVerts = [], subIndices = new Uint16Array(idxCount);
  for (let i = 0; i < idxCount; i++) {
    const oldVi = srcIdx[idxStart + i];
    let newVi = remap[oldVi];
    if (newVi === -1) { newVi = usedVerts.length; remap[oldVi] = newVi; usedVerts.push(oldVi); }
    subIndices[i] = newVi;
  }
  const vCount = usedVerts.length, pArr = new Float32Array(vCount * 3), nArr = new Float32Array(vCount * 3), uArr = uv ? new Float32Array(vCount * 2) : null;
  for (let k = 0; k < vCount; k++) {
    const vi = usedVerts[k];
    pArr[k * 3] = pos.getX(vi); pArr[k * 3 + 1] = pos.getY(vi); pArr[k * 3 + 2] = pos.getZ(vi);
    if (norm) { nArr[k * 3] = norm.getX(vi); nArr[k * 3 + 1] = norm.getY(vi); nArr[k * 3 + 2] = norm.getZ(vi); }
    if (uArr) { uArr[k * 2] = uv.getX(vi); uArr[k * 2 + 1] = uv.getY(vi); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nArr, 3));
  if (uArr) out.setAttribute('uv', new THREE.BufferAttribute(uArr, 2));
  out.setIndex(new THREE.BufferAttribute(subIndices, 1));
  out.applyMatrix4(worldMat4);
  return out;
}

function getSharedLooseBasicVcMaterial(withPolygonOffset = false) {
  if (withPolygonOffset) {
    if (!_sharedLooseBasicOffsetVcMat) {
      _sharedLooseBasicOffsetVcMat = markAsSharedAsset(new THREE.MeshBasicMaterial({
        color: 0xffffff, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
      }));
    }
    return _sharedLooseBasicOffsetVcMat;
  }
  if (!_sharedLooseBasicVcMat) {
    _sharedLooseBasicVcMat = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
  }
  return _sharedLooseBasicVcMat;
}

export const worldBatchingAndFreezeMethods = {
  _freezeStaticSceneGraph(staticPhaseChildren) {
    if (!this.scene) return;
    this.scene.updateMatrixWorld(true);
    this.scene.matrixAutoUpdate = false;

    const optGrpList = (list, fn) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const g = fn ? fn(list[i]) : list[i];
        if (g?.isGroup) optimizeStaticGroupMeshes(g);
      }
    };
    optGrpList(this.clouds);
    optGrpList(this.rotatingElements, (r) => r?.mesh);
    optGrpList(this.ferrisWheelCabins);
    if (this.ferrisWheelGroup?.isGroup) optimizeStaticGroupMeshes(this.ferrisWheelGroup, this.ferrisWheelCabins || []);
    optGrpList(this.cargoShips, (s) => s?.mesh || s);
    optGrpList(this.superBankData?.gates, (g) => g?.mesh || g);
    optGrpList(this.attractions?.coasterCars);
    optGrpList(this.attractions?.baileWoofers, (w) => w?.pivot);
    if (this.attractions?.djRig?.root?.isGroup) optimizeStaticGroupMeshes(this.attractions.djRig.root);
    optGrpList(this.livingCity?.wantedSystem?.roadblocks, (rb) => rb?.group || rb?.mesh);
    if (this.livingCity?.factionWar) {
      for (const zs of Object.values(this.livingCity.factionWar.territories || this.livingCity.factionWar.zoneStates || {})) {
        for (const cz of zs?.captureZones || []) if (cz?.group?.isGroup) optimizeStaticGroupMeshes(cz.group, cz.ringMesh ? [cz.ringMesh] : []);
      }
    }
    if (this.attractions?.bigDropGondola?.isGroup) optimizeStaticGroupMeshes(this.attractions.bigDropGondola);
    if (this.livingCity?.civilianSkyHeli?.group) {
      const ch = this.livingCity.civilianSkyHeli;
      optimizeStaticGroupMeshes(ch.group, [ch.mainRotor, ch.tailRotor]);
    }
    if (this.territoryInfra && typeof this.territoryInfra === 'object') {
      for (const inf of Object.values(this.territoryInfra)) {
        for (const op of inf?.outposts || []) {
          if (op?.dishGroup?.isGroup) optimizeStaticGroupMeshes(op.dishGroup);
          if (op?.sirenBar?.isGroup) optimizeStaticGroupMeshes(op.sirenBar);
        }
      }
    }

    const dynamicRoots = new Set();
    const addDyn = (obj) => { if (obj && obj.isObject3D) dynamicRoots.add(obj); };
    const addDynList = (list, fn) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) addDyn(fn ? fn(list[i]) : list[i]);
    };

    [this.beaconGroup, this.hemiLight, this.sunLight, this.sunLight?.target, this.ferrisWheelGroup].forEach(addDyn);
    addDynList(this.ferrisWheelCabins);
    addDynList(this.clouds);
    addDynList(this.rotatingElements, (r) => r?.mesh);
    addDynList(this.cargoShips, (s) => s?.mesh || s);
    addDynList(this.superBankData?.gates, (g) => g?.mesh || g);
    for (const tr of this.metroSystem?.trains || []) addDynList(tr?.cars, (c) => c?.group);
    if (this.destructibles) {
      const d = this.destructibles;
      addDynList(d._dynamicObjects, (o) => o?.mesh);
      addDynList(d.ambientStuds, (s) => s?.mesh);
      [d.solarBeamGroup, d.solarMuzzleGroup, d.beamHitSphere, d.supernovaChargeGroup].forEach(addDyn);
    }
    if (this.atmosphere) {
      addDyn(this.atmosphere.celestialRoot);
      addDynList(this.atmosphere.pointLightPool);
      addDynList(this.atmosphere.lighthouseBeams, (lb) => lb?.pivot);
      addDynList(this.atmosphere.metroLeadCones);
    }
    addDynList(this.favelaBaileSkytrackers, (st) => st?.pivot);
    if (this.attractions) {
      const at = this.attractions;
      addDynList(at.baileWoofers, (w) => w?.pivot);
      addDynList(at.baileEqBars);
      addDyn(at.djRig?.root);
      for (const im of at.baileCrowd?.allInstMeshes || []) addDyn(im);
      addDynList(at.baileLaserPivots, (ls) => ls?.pivot);
      addDynList(at.coasterCars);
      addDyn(at.bigDropGondola);
    }
    if (this.territoryInfra && typeof this.territoryInfra === 'object') {
      for (const infra of Object.values(this.territoryInfra)) {
        if (!infra) continue;
        addDynList(infra.gates, (g) => g?.flagMesh);
        for (const op of infra.outposts || []) {
          if (op) [op.ringMesh, op.beaconMesh, op.dishGroup, op.sirenBar, op.spotlightCone].forEach(addDyn);
        }
      }
    }
    if (this.livingCity) {
      const lc = this.livingCity;
      addDynList(lc.trafficVehicles, (tv) => tv?.mesh || tv);
      addDyn(lc.civilianSkyHeli?.group || lc.civilianSkyHeli?.mesh || lc.civilianSkyHeli);
      addDynList(lc.combatNpcs, (n) => n?.visual?.root || n?.mesh);
      addDynList(lc.npcProjectiles, (p) => p?.mesh || p);
      addDynList(lc.healStations, (h) => h?.group || h?.mesh);
      addDynList(lc.healthCrystals, (c) => c?.mesh || c);
      for (const p of Object.values(lc._pedInstPools || {})) {
        if (p?.isObject3D) addDyn(p); else if (Array.isArray(p)) addDynList(p);
      }
      if (lc.factionWar) {
        const fw = lc.factionWar;
        addDynList(fw.combatNpcs, (n) => n?.visual?.root || n?.mesh);
        addDynList(fw.projectiles, (p) => p?.mesh || p);
        addDynList(fw.healBeams, (b) => b?.mesh || b);
        for (const zs of Object.values(fw.territories || fw.zoneStates || {})) {
          addDynList(zs?.garrisonUnits, (u) => u?.visual?.root || u?.mesh);
          addDynList(zs?.captureZones, (cz) => cz?.group || cz?.ringMesh);
        }
      }
      if (lc.wantedSystem) {
        const wsSys = lc.wantedSystem;
        addDynList(wsSys.activeUnits, (u) => u?.mesh || u?.visual?.root);
        addDynList(wsSys.policeCars, (u) => u?.mesh || u);
        addDynList(wsSys.helicopters, (h) => h?.mesh || h?.group || h);
        addDynList(wsSys.roadblocks, (rb) => rb?.group || rb?.mesh);
      }
    }

    const dynamicSubtreeSet = new Set();
    const ancestorSet = new Set();
    for (const dyn of dynamicRoots) {
      dyn.traverse((child) => {
        dynamicSubtreeSet.add(child);
        if (child.userData) child.userData._keepDynamicMatrix = true;
      });
      for (let p = dyn.parent; p && p !== this.scene; p = p.parent) ancestorSet.add(p);
    }

    this._batchLooseStaticSceneMeshes(staticPhaseChildren, dynamicSubtreeSet);
    this._chunkAndBoundStaticInstancedMeshes(staticPhaseChildren, dynamicSubtreeSet);

    const freezeBranch = (node) => {
      if (dynamicSubtreeSet.has(node)) return;
      if (ancestorSet.has(node)) {
        node.matrixAutoUpdate = false;
        node.matrixWorldAutoUpdate = true;
        for (let i = 0; i < node.children.length; i++) freezeBranch(node.children[i]);
        return;
      }
      node.traverse((n) => {
        n.matrixAutoUpdate = false;
        n.matrixWorldAutoUpdate = false;
      });
    };

    for (const rootChild of staticPhaseChildren) {
      if (rootChild && rootChild.parent === this.scene) freezeBranch(rootChild);
    }

    this.scene.traverse((im) => {
      if (im && im.isInstancedMesh && im.frustumCulled !== false && im.count > 0 && !im.boundingSphere) {
        im.computeBoundingBox();
        im.computeBoundingSphere();
      }
    });
  },

  _chunkAndBoundStaticInstancedMeshes(staticPhaseChildren, dynamicSubtreeSet) {
    if (!this.scene) return;
    const runtimeInstSet = new Set();
    if (this.destructibles?._ambientStudPools) {
      for (const p of this.destructibles._ambientStudPools.values()) if (p?.inst) runtimeInstSet.add(p.inst);
    }
    if (this.destructibles?.objects) {
      for (const o of this.destructibles.objects) {
        if (o?._instPool) runtimeInstSet.add(o._instPool);
        if (o?._propInstSlots) {
          for (let s = 0; s < o._propInstSlots.length; s++) {
            if (o._propInstSlots[s]?.pool?.inst) runtimeInstSet.add(o._propInstSlots[s].pool.inst);
          }
        }
      }
    }

    const candidates = [];
    for (const child of this.scene.children) {
      if (
        child?.isInstancedMesh && child.frustumCulled !== false && child.count > 0 &&
        !dynamicSubtreeSet.has(child) && !runtimeInstSet.has(child) && !child.userData?.isSuburbBreakablePool
      ) {
        child.computeBoundingBox();
        child.computeBoundingSphere();
        const g = child.geometry, triPer = g?.index ? g.index.count / 3 : (g?.attributes?.position?.count || 0) / 3;
        if (!child.instanceColor && (triPer * child.count >= 18000 || child.count >= 2000) && (child.boundingSphere?.radius ?? 0) > 900) {
          candidates.push(child);
        }
      }
    }

    const m4 = new THREE.Matrix4();
    for (let c = 0; c < candidates.length; c++) {
      const src = candidates[c], isMicroStuds = src.count >= 5000, cellSpan = isMicroStuds ? 1080 : 3200;
      const byCell = new Map();
      for (let i = 0; i < src.count; i++) {
        src.getMatrixAt(i, m4);
        const key = `${Math.floor(m4.elements[12] / cellSpan)},${Math.floor(m4.elements[14] / cellSpan)}`;
        let list = byCell.get(key);
        if (!list) { list = []; byCell.set(key, list); }
        list.push(i);
      }
      if (byCell.size <= 1) continue;

      for (const indices of byCell.values()) {
        const sub = new THREE.InstancedMesh(src.geometry, src.material, indices.length);
        sub.castShadow = src.castShadow; sub.receiveShadow = src.receiveShadow; sub.matrixAutoUpdate = false;
        for (let k = 0; k < indices.length; k++) { src.getMatrixAt(indices[k], m4); sub.setMatrixAt(k, m4); }
        sub.instanceMatrix.needsUpdate = true; sub.updateMatrix();
        sub.computeBoundingBox(); sub.computeBoundingSphere();
        if (isMicroStuds && sub.boundingSphere) {
          const sc = sub.boundingSphere.center, cx = sc.x, cy = sc.y, cz = sc.z;
          const lod = new THREE.LOD();
          lod.position.set(cx, cy, cz); sub.position.set(-cx, -cy, -cz); sub.updateMatrix();
          lod.addLevel(sub, 0); lod.addLevel(new THREE.Object3D(), 145);
          lod.matrixAutoUpdate = false; lod.updateMatrix(); lod.updateMatrixWorld(true);
          this.scene.add(lod); staticPhaseChildren.add(lod);
        } else {
          sub.updateMatrixWorld(true);
          this.scene.add(sub); staticPhaseChildren.add(sub);
        }
      }
      this.scene.remove(src); staticPhaseChildren.delete(src);
    }
  },

  _batchLooseStaticSceneMeshes(staticPhaseChildren, dynamicSubtreeSet) {
    if (!this.scene || !staticPhaseChildren) return;
    this.scene.updateMatrixWorld(true);

    const noMergeSet = new Set(dynamicSubtreeSet);
    const markSubtree = (root) => { if (root && typeof root.traverse === 'function') root.traverse((c) => noMergeSet.add(c)); };
    for (const obj of this.destructibles?.objects || []) markSubtree(obj?.mesh);
    for (const fc of this.favelaSoccerFloodCones || []) markSubtree(fc?.mesh);
    for (const sb of this.favelaSummitBeacons || []) markSubtree(sb?.group);
    for (const bm of this.helicarrierNightFX?.beaconMeshes || []) markSubtree(bm);
    markSubtree(this.helicarrierShowcaseHolo);

    const protectedDynamicMats = collectProtectedDynamicMaterials(this);
    const CHUNK_SIZE = 2150, AUX_CHUNK_SIZE = 8800, OUTER_CHUNK_SIZE = 14000;
    const worldBox = new THREE.Box3(), nearScratch = [], buckets = new Map();
    let matIdSeq = 0;
    const matIds = new WeakMap();
    const getMatId = (mat) => {
      let id = matIds.get(mat);
      if (id === undefined) { id = ++matIdSeq; matIds.set(mat, id); }
      return id;
    };
    const getByMatBucketSig = (mat) => {
      if (!mat || protectedDynamicMats.has(mat) || mat.map || mat.emissiveMap || mat.alphaMap || mat.userData?.isDynamicMaterial) {
        return `id:${getMatId(mat)}`;
      }
      const hex = Math.round(((mat.color?.getHex?.() ?? 0xffffff) >> 4)) << 4;
      const opBucket = mat.transparent ? Math.round((mat.opacity ?? 0.5) * 6) : 99;
      return `sig:${mat.isMeshBasicMaterial ? 'B' : 'P'}:${hex}:${opBucket}:${mat.blending || 0}:${mat.depthWrite === false ? 0 : 1}`;
    };

    const pushToBucket = (bKey, kind, mat, minX, maxX, minY, maxY, minZ, maxZ, castS, recvS, itemPayload) => {
      let bucket = buckets.get(bKey);
      if (!bucket) {
        bucket = {
          kind, mat, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
          minZ: Infinity, maxZ: -Infinity, anyCastShadow: false, anyReceiveShadow: false, items: []
        };
        buckets.set(bKey, bucket);
      }
      if (minX < bucket.minX) bucket.minX = minX; if (maxX > bucket.maxX) bucket.maxX = maxX;
      if (minY < bucket.minY) bucket.minY = minY; if (maxY > bucket.maxY) bucket.maxY = maxY;
      if (minZ < bucket.minZ) bucket.minZ = minZ; if (maxZ > bucket.maxZ) bucket.maxZ = maxZ;
      if (castS) bucket.anyCastShadow = true; if (recvS) bucket.anyReceiveShadow = true;
      bucket.items.push(itemPayload);
    };

    const signNodesToRemove = [];

    const visit = (node) => {
      if (
        !node || node.visible === false || noMergeSet.has(node) || node.isLOD ||
        node.userData?.isDetailedBuilding || node.userData?.skipStaticMerge ||
        node.name === 'CollisionDebugOverlay'
      ) return;

      if (
        node.isMesh && !node.isInstancedMesh && node.frustumCulled !== false &&
        Array.isArray(node.material) && node.material.length === 6 &&
        node.material[4]?.userData?.isSignAtlasMaterial && node.geometry?.index
      ) {
        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        const bb = node.geometry.boundingBox;
        if (bb && !bb.isEmpty()) {
          worldBox.copy(bb).applyMatrix4(node.matrixWorld);
          const { min, max } = worldBox;
          if (Number.isFinite(min.x + max.x + min.y + max.y + min.z + max.z)) {
            const cx = (min.x + max.x) * 0.5, cz = (min.z + max.z) * 0.5;
            const cs = getVcCellSpan(cx, cz, CHUNK_SIZE);
            const auxCs = Math.abs(cx) > 4500 || Math.abs(cz) > 4500 ? OUTER_CHUNK_SIZE : AUX_CHUNK_SIZE;
            const cKey = `${cs}:${Math.floor(cx / cs)},${Math.floor(cz / cs)}`;
            const matKey = `${auxCs}:${Math.floor(cx / auxCs)},${Math.floor(cz / auxCs)}`;
            const faceMat = node.material[4], isDouble = node.material[5] === faceMat;
            const edgeGeo = extractSignSliceGeo(node.geometry, 0, isDouble ? 24 : 36, node.matrixWorld);
            const faceGeo = extractSignSliceGeo(node.geometry, 24, isDouble ? 12 : 6, node.matrixWorld);
            if (!isDouble && edgeGeo && node.geometry.index.count >= 36) {
              const e1 = extractSignSliceGeo(node.geometry, 0, 24, node.matrixWorld);
              const e2 = extractSignSliceGeo(node.geometry, 30, 6, node.matrixWorld);
              pushToBucket(`vcStd|${cKey}`, 'vcStd', node.material[0], min.x, max.x, min.y, max.y, min.z, max.z, false, false, { preBuiltGeo: e1 && e2 ? mergeBufferGeometries([e1, e2]) : edgeGeo, mat: node.material[0] });
            } else if (edgeGeo) {
              pushToBucket(`vcStd|${cKey}`, 'vcStd', node.material[0], min.x, max.x, min.y, max.y, min.z, max.z, false, false, { preBuiltGeo: edgeGeo, mat: node.material[0] });
            }
            if (faceGeo) {
              pushToBucket(`byMat|${matKey}|${getMatId(faceMat)}`, 'byMat', faceMat, min.x, max.x, min.y, max.y, min.z, max.z, false, false, { preBuiltGeo: faceGeo, mat: faceMat });
            }
            signNodesToRemove.push(node);
            return;
          }
        }
      }

      if (
        node.isMesh && !node.isInstancedMesh && node.frustumCulled !== false &&
        node.material && !Array.isArray(node.material) && !node.userData?.isWater && !node.userData?.isOcean
      ) {
        const mat = node.material, posAttr = node.geometry?.attributes?.position, colAttr = node.geometry?.attributes?.color, matHex = mat.color?.getHex?.();
        const isViaductShadowSlab = Boolean(node.castShadow && matHex === 0xcbd5e1);
        if (
          posAttr && posAttr.count > 0 && posAttr.count <= 950000 &&
          (!colAttr || colAttr.itemSize === 3) && !mat.userData?.hasAnimatedLegoWater &&
          !mat.uniforms && mat.side !== THREE.BackSide && matHex !== 0x0369a1
        ) {
          if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
          const bb = node.geometry.boundingBox;
          if (bb && !bb.isEmpty()) {
            worldBox.copy(bb).applyMatrix4(node.matrixWorld);
            const { min, max } = worldBox;
            if (Number.isFinite(min.x + max.x + min.y + max.y + min.z + max.z)) {
              const cx = (min.x + max.x) * 0.5, cz = (min.z + max.z) * 0.5;
              const spanX = max.x - min.x, spanZ = max.z - min.z;
              const cs = getVcCellSpan(cx, cz, CHUNK_SIZE);
              const isAnimEmissiveDyn = protectedDynamicMats.has(mat) && (Boolean(mat.emissive && mat.emissive.getHex() !== 0 && (mat.emissiveIntensity ?? 0) > 0.05) || mat.transparent);
              const noTex = !mat.map && !mat.emissiveMap && !mat.alphaMap;

              let kind = null;
              if (isViaductShadowSlab) kind = 'byMat';
              else if (!isAnimEmissiveDyn && !mat.transparent && !mat.isMeshBasicMaterial && noTex) kind = mat.polygonOffset ? 'vcStdPo' : 'vcStd';
              else if (!isAnimEmissiveDyn && mat.isMeshBasicMaterial && !mat.transparent && noTex) kind = mat.polygonOffset ? 'vcBasicPo' : 'vcBasic';
              else if (!mat.transparent || (!mat.map && !mat.alphaMap && (mat.blending === THREE.AdditiveBlending || mat.depthWrite === false || mat.isMeshPhysicalMaterial || mat.isMeshStandardMaterial || mat.isMeshBasicMaterial))) kind = 'byMat';

              if (kind) {
                if (kind === 'vcStd' && (spanX > cs * 1.15 || spanZ > cs * 1.15)) {
                  const fbCol = colAttr ? _WHITE_COL : mat.emissive && mat.emissive.getHex() !== 0 && (mat.emissiveIntensity ?? 0) > 0.25 ? mat.emissive : (mat.color || _WHITE_COL);
                  const slices = sliceWideVcGeoToCells(node.geometry, node.matrixWorld, fbCol, CHUNK_SIZE);
                  for (let s = 0; s < slices.length; s++) {
                    const sl = slices[s];
                    pushToBucket(`vcStd|${sl.cKey}`, 'vcStd', mat, sl.minX, sl.maxX, sl.minY, sl.maxY, sl.minZ, sl.maxZ, node.castShadow, node.receiveShadow, { preBuiltGeo: sl.geo, mat });
                  }
                  signNodesToRemove.push(node);
                } else {
                  const effCs = (kind === 'vcStd' || isViaductShadowSlab) ? cs : (Math.abs(cx) > 4500 || Math.abs(cz) > 4500 ? OUTER_CHUNK_SIZE : AUX_CHUNK_SIZE);
                  const cKey = `${effCs}:${Math.floor(cx / effCs)},${Math.floor(cz / effCs)}`;
                  const bKey = isViaductShadowSlab ? `byMat|viaduct|${cKey}` : kind === 'byMat' ? `byMat|${cKey}|${getByMatBucketSig(mat)}` : `${kind}|${cKey}`;
                  pushToBucket(bKey, kind, mat, min.x, max.x, min.y, max.y, min.z, max.z, node.castShadow, node.receiveShadow, { node, mat });
                }
              }
            }
          }
        }
      }

      if (node.children?.length) {
        for (let i = 0; i < node.children.length; i++) visit(node.children[i]);
      }
    };

    for (const rootChild of staticPhaseChildren) {
      if (rootChild && rootChild.parent === this.scene) visit(rootChild);
    }

    const bucketHasColliderOverlap = (b) => {
      const spanX = b.maxX - b.minX, spanZ = b.maxZ - b.minZ, height = b.maxY - b.minY;
      if (spanX < 2.4 || spanZ < 2.4 || height < 2.4) return true;
      const cx = (b.minX + b.maxX) * 0.5, cz = (b.minZ + b.maxZ) * 0.5;
      const nearby = typeof this.getCollidersNear === 'function'
        ? this.getCollidersNear(cx, cz, Math.hypot(spanX, spanZ) * 0.5 + 1.0, nearScratch)
        : (this.colliders || []);
      for (let i = 0; i < nearby.length; i++) {
        const c = nearby[i];
        if (!c || c.disabled) continue;
        const cMinY = Math.min(c.minY, c.maxY), cMaxY = Math.max(c.minY, c.maxY);
        if (c.maxX > b.minX + 0.1 && c.minX < b.maxX - 0.1 && cMaxY > b.minY + 0.1 && cMinY < b.maxY - 0.1 && c.maxZ > b.minZ + 0.1 && c.minZ < b.maxZ - 0.1) return true;
      }
      return false;
    };

    // Agrupa buckets pequenos rejeitados por spanOk em células regionais de 1800m..3600m por kind/mat
    const fallbackSuperBuckets = new Map();
    for (const [bKey, b] of buckets.entries()) {
      const hasPreBuilt = b.items.some((it) => Boolean(it.preBuiltGeo));
      const ok = (b.items.length >= 2 || hasPreBuilt) && (b.maxX - b.minX > 148 || b.maxZ - b.minZ > 148 || b.maxY - b.minY < 2.4 || bucketHasColliderOverlap(b));
      if (ok) continue;
      buckets.delete(bKey);
      const mcx = (b.minX + b.maxX) * 0.5, mcz = (b.minZ + b.maxZ) * 0.5;
      const sSpan = b.kind === 'vcStd' ? (Math.abs(mcx) <= 4500 && Math.abs(mcz) <= 4500 ? 3200 : 8400) : 28000;
      const cellTag = `${sSpan}:${Math.floor(mcx / sSpan)},${Math.floor(mcz / sSpan)}`;
      const superKey = b.kind === 'byMat' ? `super|byMat|${getByMatBucketSig(b.mat)}|${cellTag}` : `super|${b.kind}|${cellTag}`;
      let sb = fallbackSuperBuckets.get(superKey);
      if (!sb) {
        sb = { kind: b.kind, mat: b.mat, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity, anyCastShadow: false, anyReceiveShadow: false, items: [], isSuperCell: true };
        fallbackSuperBuckets.set(superKey, sb);
      }
      if (b.minX < sb.minX) sb.minX = b.minX; if (b.maxX > sb.maxX) sb.maxX = b.maxX;
      if (b.minY < sb.minY) sb.minY = b.minY; if (b.maxY > sb.maxY) sb.maxY = b.maxY;
      if (b.minZ < sb.minZ) sb.minZ = b.minZ; if (b.maxZ > sb.maxZ) sb.maxZ = b.maxZ;
      if (b.anyCastShadow) sb.anyCastShadow = true; if (b.anyReceiveShadow) sb.anyReceiveShadow = true;
      for (let i = 0; i < b.items.length; i++) sb.items.push(b.items[i]);
    }
    for (const [sKey, sb] of fallbackSuperBuckets.entries()) buckets.set(sKey, sb);

    const touchedParents = new Set();
    for (let i = 0; i < signNodesToRemove.length; i++) {
      const sn = signNodesToRemove[i];
      if (sn.parent) { touchedParents.add(sn.parent); sn.parent.remove(sn); staticPhaseChildren.delete(sn); }
    }

    const sharedStdVcMat = getSharedLooseStdVcMaterial(false), sharedStdOffsetVcMat = getSharedLooseStdVcMaterial(true);
    const sharedBasicVcMat = getSharedLooseBasicVcMaterial(false), sharedBasicOffsetVcMat = getSharedLooseBasicVcMaterial(true);

    for (const b of buckets.values()) {
      const hasPreBuilt = b.items.some((it) => Boolean(it.preBuiltGeo));
      if (b.items.length < 2 && !hasPreBuilt) continue;
      const spanOk = b.isSuperCell || b.maxX - b.minX > 148 || b.maxZ - b.minZ > 148 || b.maxY - b.minY < 2.4 || bucketHasColliderOverlap(b);
      if (!spanOk) continue;

      let mergedGeo, mergedMat;
      const isVc = b.kind === 'vcStd' || b.kind === 'vcStdPo' || b.kind === 'vcBasic' || b.kind === 'vcBasicPo';
      if (isVc) {
        const entries = new Array(b.items.length);
        for (let i = 0; i < b.items.length; i++) {
          const it = b.items[i];
          const cloned = it.preBuiltGeo ? it.preBuiltGeo : it.node.geometry.clone();
          if (!it.preBuiltGeo) cloned.applyMatrix4(it.node.matrixWorld);
          if (!cloned.attributes.normal) cloned.computeVertexNormals();
          const col = cloned.attributes.color
            ? _WHITE_COL
            : (b.kind === 'vcStd' || b.kind === 'vcStdPo') && it.mat?.emissive && it.mat.emissive.getHex() !== 0 && (it.mat.emissiveIntensity ?? 0) > 0.25
              ? it.mat.emissive : (it.mat?.color || _WHITE_COL);
          entries[i] = { geo: cloned, color: col };
        }
        mergedGeo = mergeColoredGeometries(entries);
        mergedMat = b.kind === 'vcStd' ? sharedStdVcMat : b.kind === 'vcStdPo' ? sharedStdOffsetVcMat : b.kind === 'vcBasicPo' ? sharedBasicOffsetVcMat : sharedBasicVcMat;
      } else {
        const geos = new Array(b.items.length);
        for (let i = 0; i < b.items.length; i++) {
          const it = b.items[i];
          const cloned = it.preBuiltGeo ? it.preBuiltGeo : it.node.geometry.clone();
          if (!it.preBuiltGeo) cloned.applyMatrix4(it.node.matrixWorld);
          if (!cloned.attributes.normal) cloned.computeVertexNormals();
          geos[i] = cloned;
        }
        mergedGeo = mergeBufferGeometries(geos);
        mergedMat = b.mat;
      }

      mergedGeo.computeBoundingBox();
      const center = new THREE.Vector3();
      if (mergedGeo.boundingBox) {
        mergedGeo.boundingBox.getCenter(center);
        mergedGeo.translate(-center.x, -center.y, -center.z);
        mergedGeo.computeBoundingBox();
      }
      mergedGeo.computeBoundingSphere();
      const isBasic = b.kind === 'vcBasic' || b.kind === 'vcBasicPo' || Boolean(mergedMat.isMeshBasicMaterial);
      const mergedMesh = new THREE.Mesh(mergedGeo, mergedMat);
      mergedMesh.castShadow = !isBasic && !mergedMat.transparent && b.anyCastShadow;
      mergedMesh.receiveShadow = !isBasic && b.anyReceiveShadow;
      mergedMesh.matrixAutoUpdate = false;
      mergedMesh.updateMatrix();

      const lod1Geo = b.kind === 'vcStd' ? buildCoarseVcLodGeo(mergedGeo, 900) : null;
      const lod2Geo = b.kind === 'vcStd' ? buildCoarseVcLodGeo(mergedGeo, 3600) : null;
      if (lod1Geo || lod2Geo) {
        const lod = new THREE.LOD();
        lod.position.copy(center); lod.matrixAutoUpdate = false; lod.updateMatrix();
        lod.addLevel(mergedMesh, 0);
        mergedMesh.visible = true;
        if (lod1Geo) {
          const lod1Mesh = new THREE.Mesh(lod1Geo, mergedMat);
          lod1Mesh.castShadow = false; lod1Mesh.receiveShadow = mergedMesh.receiveShadow;
          lod1Mesh.matrixAutoUpdate = false; lod1Mesh.updateMatrix(); lod1Mesh.visible = false;
          lod.addLevel(lod1Mesh, 210);
        }
        if (lod2Geo && (!lod1Geo || lod2Geo.index.count < lod1Geo.index.count * 0.92)) {
          const lod2Mesh = new THREE.Mesh(lod2Geo, mergedMat);
          lod2Mesh.castShadow = false; lod2Mesh.receiveShadow = false;
          lod2Mesh.matrixAutoUpdate = false; lod2Mesh.updateMatrix(); lod2Mesh.visible = false;
          lod.addLevel(lod2Mesh, 740);
        }
        lod.updateMatrixWorld(true);
        this.scene.add(lod); staticPhaseChildren.add(lod);
      } else {
        mergedMesh.position.copy(center); mergedMesh.updateMatrix(); mergedMesh.updateMatrixWorld(true);
        this.scene.add(mergedMesh); staticPhaseChildren.add(mergedMesh);
      }

      for (let i = 0; i < b.items.length; i++) {
        const oldNode = b.items[i].node;
        if (oldNode && oldNode.parent) { touchedParents.add(oldNode.parent); oldNode.parent.remove(oldNode); staticPhaseChildren.delete(oldNode); }
      }
    }

    for (const p of touchedParents) {
      for (let cur = p; cur && cur !== this.scene; ) {
        const nextParent = cur.parent;
        if (
          !cur.isMesh && !cur.isLight && !cur.isLOD && !cur.isPoints &&
          !cur.isLine && !noMergeSet.has(cur) && cur.children.length === 0 && nextParent
        ) {
          nextParent.remove(cur);
          if (nextParent === this.scene) staticPhaseChildren.delete(cur);
          cur = nextParent;
        } else break;
      }
    }
  },

  addBuildingBox(x, z, w, h, d, colorHex, opts = {}) {
    const terrainY = this.getTerrainHeightAt ? this.getTerrainHeightAt(x, z) : 0;
    const defaultPad = IS_SCALED_WORLD ? (getScaledUrbanCurbLiftAt(this, x, z) > 0.05 ? 0.02 : ROAD.curbHeight) : 0.28;
    const yBase = opts.yBase ?? (terrainY + defaultPad);
    const ux = fromWs(x), uz = fromWs(z);
    const overUnderground = (ux >= -115 && ux <= 115 && uz >= -210 && uz <= 85) || (ux >= -375 && ux <= -260 && uz >= -235 && uz <= -125);
    const skirtDepth = overUnderground && terrainY < 0.25 ? 0.28 : 8.5;
    const addSkirt = opts.yBase === undefined && opts.foundation !== false && skirtDepth > 0.5;
    const totalH = addSkirt ? h + skirtDepth : h;
    const centerY = addSkirt ? yBase + h * 0.5 - skirtDepth * 0.5 : yBase + h * 0.5;
    const matOpts = { studs: opts.studs ?? false, studStep: opts.studStep ?? 3.5, roughness: opts.roughness ?? 0.24, metalness: opts.metalness ?? 0.08 };
    let mesh;
    if (!opts.studs) {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, totalH, d), getLegoMaterial(colorHex, matOpts));
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
    } else {
      mesh = createLegoBrick(w, totalH, d, colorHex, matOpts);
    }
    mesh.position.set(x, centerY, z);
    this.scene.add(mesh);
    if (opts.collide !== false) this.addCollider(x, z, w, d, yBase + h, addSkirt ? Math.max(0, yBase - skirtDepth) : yBase);
    if (opts.registerMap !== false) {
      this.mapBuildings.push({ x, z, w, d, height: h, color: opts.mapColor || `#${new THREE.Color(colorHex).getHexString()}`, label: opts.label || null });
    }
    return mesh;
  },

  createDetailedBuilding(x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) { return buildDetailedBuilding(this, x, z, w, h, d, styleKey, opts); },
  _buildUrbanDowntownBlock(bx, bz, W, D, layoutType, mainHeight, seed) { return buildUrbanDowntownBlock(this, bx, bz, W, D, layoutType, mainHeight, seed); },
  _createLegoCarMesh(cfg) { return createLegoCarMesh(cfg); },

  _addCityBlockSidewalk(x, z, w, d, colorHex = LEGO_COLORS.sidewalk, explicitYBase = undefined) {
    if (!this._sidewalkGeosByColor.has(colorHex)) this._sidewalkGeosByColor.set(colorHex, []);
    const geoBucket = this._sidewalkGeosByColor.get(colorHex);
    const minX = x - w * 0.5, maxX = x + w * 0.5, minZ = z - d * 0.5, maxZ = z + d * 0.5;
    if (!this.mapSidewalks) this.mapSidewalks = [];
    this.mapSidewalks.push({ minX, maxX, minZ, maxZ });

    const hitsCutout = METRO_ISLAND_CUTOUTS.some((c) => c.maxX > minX && c.minX < maxX && c.maxZ > minZ && c.minZ < maxZ);
    if (hitsCutout) {
      const yBase = explicitYBase ?? 0;
      for (const r of sliceRectAroundCutouts({ minX, maxX, minZ, maxZ }, METRO_ISLAND_CUTOUTS)) {
        const pw = r.maxX - r.minX, pd = r.maxZ - r.minZ;
        if (pw > 0.02 && pd > 0.02) geoBucket.push(makeFastBox(pw, 0.28, pd, (r.minX + r.maxX) * 0.5, yBase + 0.14, (r.minZ + r.maxZ) * 0.5));
      }
    } else if (explicitYBase !== undefined) {
      const overUnder = (x >= -115 && x <= 115 && z >= -210 && z <= 85) || (x >= -375 && x <= -260 && z >= -235 && z <= -125);
      const slabH = overUnder && explicitYBase <= 0.2 ? 0.28 : 8.2;
      geoBucket.push(makeFastBox(w, slabH, d, x, explicitYBase + 0.28 - slabH * 0.5, z));
    } else {
      const yC = this.getTerrainHeightAt(x, z), yNW = this.getTerrainHeightAt(minX, minZ), yNE = this.getTerrainHeightAt(maxX, minZ);
      const ySW = this.getTerrainHeightAt(minX, maxZ), ySE = this.getTerrainHeightAt(maxX, maxZ);
      const minCorner = Math.min(yC, yNW, yNE, ySW, ySE), maxCorner = Math.max(yC, yNW, yNE, ySW, ySE);
      const overUnder = (x >= -115 && x <= 115 && z >= -210 && z <= 85) || (x >= -375 && x <= -260 && z >= -235 && z <= -125);
      if (maxCorner - minCorner <= 0.16) {
        const slabH = overUnder && yC <= 0.2 ? 0.28 : 4.2;
        geoBucket.push(makeFastBox(w, slabH, d, x, yC + 0.28 - slabH * 0.5, z));
      } else {
        const segX = Math.max(3, Math.min(10, Math.round(w / 14))), segZ = Math.max(3, Math.min(10, Math.round(d / 14)));
        const topGeo = new THREE.PlaneGeometry(w, d, segX, segZ).rotateX(-Math.PI / 2).translate(x, 0, z);
        const pos = topGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, this.getTerrainHeightAt(pos.getX(i), pos.getZ(i)) + 0.28);
        topGeo.computeVertexNormals();
        geoBucket.push(topGeo);

        const skirtH = 8.5, stepX = w / segX, stepZ = d / segZ;
        for (let ix = 0; ix < segX; ix++) {
          const sx = minX + (ix + 0.5) * stepX;
          geoBucket.push(
            makeFastBox(stepX + 0.08, skirtH, 1.2, sx, this.getTerrainHeightAt(sx, minZ) + 0.28 - skirtH * 0.5, minZ + 0.6),
            makeFastBox(stepX + 0.08, skirtH, 1.2, sx, this.getTerrainHeightAt(sx, maxZ) + 0.28 - skirtH * 0.5, maxZ - 0.6)
          );
        }
        for (let iz = 0; iz < segZ; iz++) {
          const sz = minZ + (iz + 0.5) * stepZ;
          geoBucket.push(
            makeFastBox(1.2, skirtH, stepZ + 0.08, minX + 0.6, this.getTerrainHeightAt(minX, sz) + 0.28 - skirtH * 0.5, sz),
            makeFastBox(1.2, skirtH, stepZ + 0.08, maxX - 0.6, this.getTerrainHeightAt(maxX, sz) + 0.28 - skirtH * 0.5, sz)
          );
        }
      }
    }
    this.mapBlocks.push({ x, z, w, d, color: `#${new THREE.Color(colorHex).getHexString()}` });
  },

  _finalizeMergedSidewalks() {
    if (this._sidewalkGeosByColor.size === 0) return;
    const mats = new Map();
    for (const colorHex of this._sidewalkGeosByColor.keys()) mats.set(colorHex, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 }));
    flushSpatialChunkedBuckets(this.scene, this._sidewalkGeosByColor, mats, { chunkSize: 1680, castShadowFn: () => false, receiveShadowFn: () => true });
    this._sidewalkGeosByColor.clear();
  },

  _addLegoTree(x, y, z, scale = 1.0) {
    let finalY = y;
    if (y <= 0.42 && this.getTerrainHeightAt) {
      const tY = this.getTerrainHeightAt(x, z);
      if (tY > 0.08) finalY = tY + y;
    }
    this._treeInstances.push({ x, y: finalY, z, scale });
  },

  _finalizeInstancedTrees() {
    const count = this._treeInstances.length;
    if (count === 0) return;
    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.52, 2.8, 8).translate(0, 1.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.brown, roughness: 0.4 });
    const canopyGeo = new THREE.BoxGeometry(3.4, 3.2, 3.4).translate(0, 3.8, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.35 });
    const treeChunk = 3400, chunks = new Map(), dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const t = this._treeInstances[i], key = `${Math.floor(t.x / treeChunk)},${Math.floor(t.z / treeChunk)}`;
      let bucket = chunks.get(key);
      if (!bucket) { bucket = []; chunks.set(key, bucket); }
      bucket.push(t);
    }
    for (const bucket of chunks.values()) {
      const n = bucket.length;
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
      trunkInst.castShadow = false; trunkInst.receiveShadow = true; trunkInst.matrixAutoUpdate = false;
      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, n);
      canopyInst.castShadow = true; canopyInst.receiveShadow = true; canopyInst.matrixAutoUpdate = false;
      for (let i = 0; i < n; i++) {
        const t = bucket[i];
        dummy.position.set(t.x, t.y, t.z); dummy.scale.set(t.scale, t.scale, t.scale); dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix); canopyInst.setMatrixAt(i, dummy.matrix);
      }
      trunkInst.instanceMatrix.needsUpdate = true; canopyInst.instanceMatrix.needsUpdate = true;
      trunkInst.updateMatrix(); canopyInst.updateMatrix();
      trunkInst.computeBoundingBox(); trunkInst.computeBoundingSphere();
      canopyInst.computeBoundingBox(); canopyInst.computeBoundingSphere();
      const tc = trunkInst.boundingSphere?.center;
      if (tc && n >= 12) {
        const lod = new THREE.LOD();
        lod.position.set(tc.x, tc.y, tc.z); trunkInst.position.set(-tc.x, -tc.y, -tc.z); trunkInst.updateMatrix();
        lod.addLevel(trunkInst, 0); lod.addLevel(new THREE.Object3D(), 460);
        lod.matrixAutoUpdate = false; lod.updateMatrix(); lod.updateMatrixWorld(true);
        this.scene.add(lod, canopyInst);
      } else {
        this.scene.add(trunkInst, canopyInst);
      }
    }
  },

  _initWaypointBeacon() {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.visible = false;
    this.beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 240, 16, 1, true).translate(0, 120, 0), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
    this.beaconCore = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 240, 12, 1, true).translate(0, 120, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide }));
    this.beaconRing.position.y = 0.45;
    this.beaconGroup.add(this.beaconBeam, this.beaconCore, this.beaconRing);
    this.scene.add(this.beaconGroup);
  },

  setWaypoint(x, z, label = 'DESTINO MARCADO') {
    this.waypoint = { x, z, label };
    this.beaconGroup.position.set(x, Math.max(0, this.getTerrainHeightAt(x, z)), z);
    this.beaconGroup.visible = true;
    soundFX.playStudCollect(100);
  },

  clearWaypoint() { this.waypoint = null; this.beaconGroup.visible = false; },

  _setupSkyAndLights() {
    this.scene.background = new THREE.Color(0x0a101a);
    this.scene.fog = new THREE.FogExp2(0x0a101a, 0.00082);
    const hemiLight = new THREE.HemisphereLight(0x1f2d42, 0x05070c, 0.24);
    hemiLight.position.set(0, 480, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;
    const sunLight = new THREE.DirectionalLight(0x6488a8, 0.48), d = 95;
    sunLight.position.set(140, 260, 120);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 10; sunLight.shadow.camera.far = 920;
    sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.normalBias = 0.048; sunLight.shadow.bias = -0.0005;
    if (!this.waterShaderUniforms) this.waterShaderUniforms = { uTime: { value: 0 } };
    this.scene.add(sunLight, sunLight.target);
    this.sunLight = sunLight;
  }
};
