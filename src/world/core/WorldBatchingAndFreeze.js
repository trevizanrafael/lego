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
  mergeBufferGeometries, mergeColoredGeometries
} from '../BuildingGenerator.js';
import { createLegoCarMesh } from '../StreetPropsBuilder.js';
import { buildUrbanDowntownBlock } from '../regions/DowntownBuilder.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from '../MetroSystemBuilder.js';
import { IS_SCALED_WORLD, ROAD, ws, fromWs } from './WorldLayoutScale.js';
import { getScaledUrbanCurbLiftAt } from '../terrain/UrbanSidewalkAndBlockBuilder.js';
import { collectProtectedDynamicMaterials } from '../../graphics/MaterialRegistry.js';

const _WHITE_COL = new THREE.Color(0xffffff);
let _sharedLooseStdVcMat = null;
let _sharedLooseStdOffsetVcMat = null;
let _sharedLooseBasicVcMat = null;
let _sharedLooseBasicOffsetVcMat = null;

function getSharedLooseStdVcMaterial(withPolygonOffset = false) {
  if (withPolygonOffset) {
    if (!_sharedLooseStdOffsetVcMat) {
      _sharedLooseStdOffsetVcMat = markAsSharedAsset(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.5,
          metalness: 0.12,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        })
      );
    }
    return _sharedLooseStdOffsetVcMat;
  }
  if (!_sharedLooseStdVcMat) {
    _sharedLooseStdVcMat = markAsSharedAsset(
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.12 })
    );
  }
  return _sharedLooseStdVcMat;
}

function extractSignSliceGeo(srcGeo, idxStart, idxCount, worldMat4) {
  const pos = srcGeo.attributes.position;
  const norm = srcGeo.attributes.normal;
  const uv = srcGeo.attributes.uv;
  const srcIdx = srcGeo.index?.array;
  if (!pos || !srcIdx || srcIdx.length < idxStart + idxCount) return null;

  const remap = new Int32Array(pos.count).fill(-1);
  const usedVerts = [];
  const subIndices = new Uint16Array(idxCount);
  for (let i = 0; i < idxCount; i++) {
    const oldVi = srcIdx[idxStart + i];
    let newVi = remap[oldVi];
    if (newVi === -1) {
      newVi = usedVerts.length;
      remap[oldVi] = newVi;
      usedVerts.push(oldVi);
    }
    subIndices[i] = newVi;
  }

  const vCount = usedVerts.length;
  const pArr = new Float32Array(vCount * 3);
  const nArr = new Float32Array(vCount * 3);
  const uArr = uv ? new Float32Array(vCount * 2) : null;
  for (let k = 0; k < vCount; k++) {
    const vi = usedVerts[k];
    pArr[k * 3] = pos.getX(vi);
    pArr[k * 3 + 1] = pos.getY(vi);
    pArr[k * 3 + 2] = pos.getZ(vi);
    if (norm) {
      nArr[k * 3] = norm.getX(vi);
      nArr[k * 3 + 1] = norm.getY(vi);
      nArr[k * 3 + 2] = norm.getZ(vi);
    }
    if (uArr) {
      uArr[k * 2] = uv.getX(vi);
      uArr[k * 2 + 1] = uv.getY(vi);
    }
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
      _sharedLooseBasicOffsetVcMat = markAsSharedAsset(
        new THREE.MeshBasicMaterial({
          color: 0xffffff, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        })
      );
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

    const dynamicRoots = new Set();
    const addDyn = (obj) => { if (obj && obj.isObject3D) dynamicRoots.add(obj); };
    const addDynList = (list, fn) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) addDyn(fn ? fn(list[i]) : list[i]);
    };

    addDyn(this.beaconGroup);
    addDyn(this.hemiLight);
    addDyn(this.sunLight);
    addDyn(this.sunLight?.target);
    addDyn(this.ferrisWheelGroup);
    addDynList(this.ferrisWheelCabins);
    addDynList(this.clouds);
    addDynList(this.rotatingElements, (r) => r?.mesh);
    addDynList(this.cargoShips, (s) => s?.mesh || s);
    addDynList(this.superBankData?.gates, (g) => g?.mesh || g);
    if (Array.isArray(this.metroSystem?.trains)) {
      for (const tr of this.metroSystem.trains) addDynList(tr?.cars, (c) => c?.group);
    }
    if (this.destructibles) {
      addDynList(this.destructibles._dynamicObjects, (o) => o?.mesh);
      addDynList(this.destructibles.ambientStuds, (s) => s?.mesh);
      addDyn(this.destructibles.solarBeamGroup);
      addDyn(this.destructibles.solarMuzzleGroup);
      addDyn(this.destructibles.beamHitSphere);
      addDyn(this.destructibles.supernovaChargeGroup);
    }
    if (this.atmosphere) {
      addDyn(this.atmosphere.celestialRoot);
      addDynList(this.atmosphere.pointLightPool);
      addDynList(this.atmosphere.lighthouseBeams, (lb) => lb?.pivot);
      addDynList(this.atmosphere.metroLeadCones);
    }
    addDynList(this.favelaBaileSkytrackers, (st) => st?.pivot);
    if (this.attractions) {
      addDynList(this.attractions.baileWoofers, (w) => w?.pivot);
      addDynList(this.attractions.baileEqBars);
      addDyn(this.attractions.djRig?.root);
      if (this.attractions.baileCrowd?.allInstMeshes) {
        for (const im of this.attractions.baileCrowd.allInstMeshes) addDyn(im);
      }
      addDynList(this.attractions.baileLaserPivots, (ls) => ls?.pivot);
      addDynList(this.attractions.coasterCars);
      addDyn(this.attractions.bigDropGondola);
    }
    if (this.territoryInfra && typeof this.territoryInfra === 'object') {
      for (const infra of Object.values(this.territoryInfra)) {
        if (!infra) continue;
        addDynList(infra.gates, (g) => g?.flagMesh);
        if (Array.isArray(infra.outposts)) {
          for (const op of infra.outposts) {
            if (!op) continue;
            addDyn(op.ringMesh);
            addDyn(op.beaconMesh);
            addDyn(op.dishGroup);
            addDyn(op.sirenBar);
            addDyn(op.spotlightCone);
          }
        }
      }
    }
    if (this.livingCity) {
      addDynList(this.livingCity.trafficVehicles, (tv) => tv?.mesh || tv);
      addDyn(this.livingCity.civilianSkyHeli?.group || this.livingCity.civilianSkyHeli?.mesh || this.livingCity.civilianSkyHeli);
      addDynList(this.livingCity.combatNpcs, (n) => n?.visual?.root || n?.mesh);
      addDynList(this.livingCity.npcProjectiles, (p) => p?.mesh || p);
      addDynList(this.livingCity.healStations, (h) => h?.group || h?.mesh);
      addDynList(this.livingCity.healthCrystals, (c) => c?.mesh || c);
      if (this.livingCity._pedInstPools) {
        for (const p of Object.values(this.livingCity._pedInstPools)) {
          if (p?.isObject3D) addDyn(p);
          else if (Array.isArray(p)) addDynList(p);
        }
      }
      const fw = this.livingCity.factionWar;
      if (fw) {
        addDynList(fw.combatNpcs, (n) => n?.visual?.root || n?.mesh);
        addDynList(fw.projectiles, (p) => p?.mesh || p);
        addDynList(fw.healBeams, (b) => b?.mesh || b);
        for (const zs of Object.values(fw.territories || fw.zoneStates || {})) {
          if (!zs) continue;
          addDynList(zs.garrisonUnits, (u) => u?.visual?.root || u?.mesh);
          addDynList(zs.captureZones, (cz) => cz?.group || cz?.ringMesh);
        }
      }
      const wsSys = this.livingCity.wantedSystem;
      if (wsSys) {
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
    const CHUNK_SIZE = 1200;
    const OUTER_CHUNK_SIZE = 3600;
    const worldBox = new THREE.Box3();
    const nearScratch = [];
    const buckets = new Map();
    let matIdSeq = 0;
    const matIds = new WeakMap();
    const getMatId = (mat) => {
      let id = matIds.get(mat);
      if (id === undefined) { id = ++matIdSeq; matIds.set(mat, id); }
      return id;
    };

    const pushToBucket = (bKey, kind, mat, wb, castS, recvS, itemPayload) => {
      let bucket = buckets.get(bKey);
      if (!bucket) {
        bucket = {
          kind, mat, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
          minZ: Infinity, maxZ: -Infinity, anyCastShadow: false, anyReceiveShadow: false, items: []
        };
        buckets.set(bKey, bucket);
      }
      if (wb.min.x < bucket.minX) bucket.minX = wb.min.x;
      if (wb.max.x > bucket.maxX) bucket.maxX = wb.max.x;
      if (wb.min.y < bucket.minY) bucket.minY = wb.min.y;
      if (wb.max.y > bucket.maxY) bucket.maxY = wb.max.y;
      if (wb.min.z < bucket.minZ) bucket.minZ = wb.min.z;
      if (wb.max.z > bucket.maxZ) bucket.maxZ = wb.max.z;
      if (castS) bucket.anyCastShadow = true;
      if (recvS) bucket.anyReceiveShadow = true;
      bucket.items.push(itemPayload);
    };

    const signNodesToRemove = [];

    const visit = (node) => {
      if (
        !node || node.visible === false || noMergeSet.has(node) || node.isLOD ||
        node.userData?.isDetailedBuilding || node.userData?.skipStaticMerge ||
        node.name === 'CollisionDebugOverlay'
      ) return;

      // Decompõe placas multi-material estáticas do SignBoardHelper (6 grupos -> 1 VC + 1 Atlas por chunk!)
      if (
        node.isMesh && !node.isInstancedMesh && node.frustumCulled !== false &&
        Array.isArray(node.material) && node.material.length === 6 &&
        node.material[4]?.userData?.isSignAtlasMaterial && node.geometry?.index
      ) {
        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        const bb = node.geometry.boundingBox;
        if (bb && !bb.isEmpty()) {
          worldBox.copy(bb).applyMatrix4(node.matrixWorld);
          if (Number.isFinite(worldBox.min.x + worldBox.max.x + worldBox.min.y + worldBox.max.y + worldBox.min.z + worldBox.max.z)) {
            const cx = (worldBox.min.x + worldBox.max.x) * 0.5;
            const cz = (worldBox.min.z + worldBox.max.z) * 0.5;
            const cs = Math.abs(cx) > 3600 || Math.abs(cz) > 3600 ? OUTER_CHUNK_SIZE : CHUNK_SIZE;
            const cKey = `${cs}:${Math.floor(cx / cs)},${Math.floor(cz / cs)}`;
            const faceMat = node.material[4];
            const isDouble = node.material[5] === faceMat;
            const edgeGeo = extractSignSliceGeo(node.geometry, 0, isDouble ? 24 : 36, node.matrixWorld);
            const faceGeo = extractSignSliceGeo(node.geometry, 24, isDouble ? 12 : 6, node.matrixWorld);
            if (!isDouble && edgeGeo && node.geometry.index.count >= 36) {
              // single-sided: edge indices 0..23 + back face 30..35
              const e1 = extractSignSliceGeo(node.geometry, 0, 24, node.matrixWorld);
              const e2 = extractSignSliceGeo(node.geometry, 30, 6, node.matrixWorld);
              const edgeMerged = e1 && e2 ? mergeBufferGeometries([e1, e2]) : edgeGeo;
              pushToBucket(`vcStd|${cKey}`, 'vcStd', node.material[0], worldBox, false, false, { preBuiltGeo: edgeMerged, mat: node.material[0] });
            } else if (edgeGeo) {
              pushToBucket(`vcStd|${cKey}`, 'vcStd', node.material[0], worldBox, false, false, { preBuiltGeo: edgeGeo, mat: node.material[0] });
            }
            if (faceGeo) {
              pushToBucket(`byMat|${cKey}|${getMatId(faceMat)}`, 'byMat', faceMat, worldBox, false, false, { preBuiltGeo: faceGeo, mat: faceMat });
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
        const mat = node.material;
        const posAttr = node.geometry?.attributes?.position;
        const colAttr = node.geometry?.attributes?.color;
        const matHex = mat.color?.getHex?.();
        if (
          posAttr && posAttr.count > 0 && posAttr.count <= 180000 &&
          (!colAttr || colAttr.itemSize === 3) && !mat.userData?.hasAnimatedLegoWater &&
          !mat.uniforms && mat.side !== THREE.BackSide && matHex !== 0x0369a1 &&
          !(node.castShadow && matHex === 0xcbd5e1)
        ) {
          if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
          const bb = node.geometry.boundingBox;
          if (bb && !bb.isEmpty()) {
            worldBox.copy(bb).applyMatrix4(node.matrixWorld);
            if (Number.isFinite(worldBox.min.x + worldBox.max.x + worldBox.min.y + worldBox.max.y + worldBox.min.z + worldBox.max.z)) {
              const cx = (worldBox.min.x + worldBox.max.x) * 0.5;
              const cz = (worldBox.min.z + worldBox.max.z) * 0.5;
              const cs = Math.abs(cx) > 3600 || Math.abs(cz) > 3600 ? OUTER_CHUNK_SIZE : CHUNK_SIZE;
              const cKey = `${cs}:${Math.floor(cx / cs)},${Math.floor(cz / cs)}`;
              const isDynMat = protectedDynamicMats.has(mat);
              const noTex = !mat.map && !mat.emissiveMap && !mat.alphaMap;

              let bKey = null;
              let kind = null;
              if (!isDynMat && !mat.transparent && !mat.isMeshBasicMaterial && noTex) {
                kind = mat.polygonOffset ? 'vcStdPo' : 'vcStd';
                bKey = `${kind}|${cKey}`;
              } else if (!isDynMat && mat.isMeshBasicMaterial && !mat.transparent && noTex) {
                kind = mat.polygonOffset ? 'vcBasicPo' : 'vcBasic';
                bKey = `${kind}|${cKey}`;
              } else if (
                !mat.transparent ||
                (!mat.map && !mat.alphaMap &&
                  (mat.blending === THREE.AdditiveBlending || mat.depthWrite === false || mat.isMeshPhysicalMaterial || mat.isMeshBasicMaterial))
              ) {
                kind = 'byMat';
                bKey = `byMat|${cKey}|${getMatId(mat)}`;
              }

              if (bKey) {
                pushToBucket(bKey, kind, mat, worldBox, node.castShadow, node.receiveShadow, { node, mat });
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
      const spanX = b.maxX - b.minX;
      const spanZ = b.maxZ - b.minZ;
      const height = b.maxY - b.minY;
      if (spanX < 2.4 || spanZ < 2.4 || height < 2.4) return true;
      const cx = (b.minX + b.maxX) * 0.5;
      const cz = (b.minZ + b.maxZ) * 0.5;
      const nearby = typeof this.getCollidersNear === 'function'
        ? this.getCollidersNear(cx, cz, Math.hypot(spanX, spanZ) * 0.5 + 1.0, nearScratch)
        : (this.colliders || []);
      for (let i = 0; i < nearby.length; i++) {
        const c = nearby[i];
        if (!c || c.disabled) continue;
        const cMinY = Math.min(c.minY, c.maxY);
        const cMaxY = Math.max(c.minY, c.maxY);
        if (
          c.maxX > b.minX + 0.1 && c.minX < b.maxX - 0.1 &&
          cMaxY > b.minY + 0.1 && cMinY < b.maxY - 0.1 &&
          c.maxZ > b.minZ + 0.1 && c.minZ < b.maxZ - 0.1
        ) return true;
      }
      return false;
    };

    // Agrupa buckets pequenos rejeitados por spanOk num super-chunk regional por kind/mat
    const fallbackSuperBuckets = new Map();
    for (const [bKey, b] of buckets.entries()) {
      const ok =
        b.items.length >= 2 &&
        (b.maxX - b.minX > 148 || b.maxZ - b.minZ > 148 || b.maxY - b.minY < 2.4 || bucketHasColliderOverlap(b));
      if (ok) continue;
      buckets.delete(bKey);
      const superKey = b.kind === 'byMat' ? `super|byMat|${getMatId(b.mat)}` : `super|${b.kind}`;
      let sb = fallbackSuperBuckets.get(superKey);
      if (!sb) {
        sb = {
          kind: b.kind, mat: b.mat, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity,
          minZ: Infinity, maxZ: -Infinity, anyCastShadow: false, anyReceiveShadow: false, items: []
        };
        fallbackSuperBuckets.set(superKey, sb);
      }
      if (b.minX < sb.minX) sb.minX = b.minX;
      if (b.maxX > sb.maxX) sb.maxX = b.maxX;
      if (b.minY < sb.minY) sb.minY = b.minY;
      if (b.maxY > sb.maxY) sb.maxY = b.maxY;
      if (b.minZ < sb.minZ) sb.minZ = b.minZ;
      if (b.maxZ > sb.maxZ) sb.maxZ = b.maxZ;
      if (b.anyCastShadow) sb.anyCastShadow = true;
      if (b.anyReceiveShadow) sb.anyReceiveShadow = true;
      for (let i = 0; i < b.items.length; i++) sb.items.push(b.items[i]);
    }
    for (const [sKey, sb] of fallbackSuperBuckets.entries()) {
      buckets.set(sKey, sb);
    }

    const touchedParents = new Set();
    for (let i = 0; i < signNodesToRemove.length; i++) {
      const sn = signNodesToRemove[i];
      if (sn.parent) {
        touchedParents.add(sn.parent);
        sn.parent.remove(sn);
        staticPhaseChildren.delete(sn);
      }
    }

    const sharedStdVcMat = getSharedLooseStdVcMaterial(false);
    const sharedStdOffsetVcMat = getSharedLooseStdVcMaterial(true);
    const sharedBasicVcMat = getSharedLooseBasicVcMaterial(false);
    const sharedBasicOffsetVcMat = getSharedLooseBasicVcMaterial(true);

    for (const b of buckets.values()) {
      const hasPreBuilt = b.items.some((it) => Boolean(it.preBuiltGeo));
      if (b.items.length < 2 && !hasPreBuilt) continue;
      const spanOk =
        b.maxX - b.minX > 148 ||
        b.maxZ - b.minZ > 148 ||
        b.maxY - b.minY < 2.4 ||
        bucketHasColliderOverlap(b);
      if (!spanOk) continue;

      let mergedGeo;
      let mergedMat;
      const isVc = b.kind === 'vcStd' || b.kind === 'vcStdPo' || b.kind === 'vcBasic' || b.kind === 'vcBasicPo';
      if (isVc) {
        const entries = new Array(b.items.length);
        for (let i = 0; i < b.items.length; i++) {
          const it = b.items[i];
          const cloned = it.preBuiltGeo ? it.preBuiltGeo : it.node.geometry.clone();
          if (!it.preBuiltGeo) cloned.applyMatrix4(it.node.matrixWorld);
          if (!cloned.attributes.normal) cloned.computeVertexNormals();
          const hasExistingVc = Boolean(cloned.attributes.color);
          const col = hasExistingVc
            ? _WHITE_COL
            : (b.kind === 'vcStd' || b.kind === 'vcStdPo') && it.mat?.emissive && it.mat.emissive.getHex() !== 0 && (it.mat.emissiveIntensity ?? 0) > 0.25
              ? it.mat.emissive
              : (it.mat?.color || _WHITE_COL);
          entries[i] = { geo: cloned, color: col };
        }
        mergedGeo = mergeColoredGeometries(entries);
        mergedMat =
          b.kind === 'vcStd'
            ? sharedStdVcMat
            : b.kind === 'vcStdPo'
              ? sharedStdOffsetVcMat
              : b.kind === 'vcBasicPo'
                ? sharedBasicOffsetVcMat
                : sharedBasicVcMat;
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

      const isBasic = b.kind === 'vcBasic' || b.kind === 'vcBasicPo' || Boolean(mergedMat.isMeshBasicMaterial);
      const mergedMesh = new THREE.Mesh(mergedGeo, mergedMat);
      mergedMesh.castShadow = !isBasic && !mergedMat.transparent && b.anyCastShadow;
      mergedMesh.receiveShadow = !isBasic && b.anyReceiveShadow;
      mergedMesh.matrixAutoUpdate = false;
      mergedMesh.updateMatrix();
      this.scene.add(mergedMesh);
      staticPhaseChildren.add(mergedMesh);

      for (let i = 0; i < b.items.length; i++) {
        const oldNode = b.items[i].node;
        if (oldNode && oldNode.parent) {
          touchedParents.add(oldNode.parent);
          oldNode.parent.remove(oldNode);
          staticPhaseChildren.delete(oldNode);
        }
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
    const defaultPad = IS_SCALED_WORLD
      ? getScaledUrbanCurbLiftAt(this, x, z) > 0.05
        ? 0.02
        : ROAD.curbHeight
      : 0.28;
    const yBase = opts.yBase ?? (terrainY + defaultPad);
    const ux = fromWs(x);
    const uz = fromWs(z);
    const overUnderground =
      (ux >= -115 && ux <= 115 && uz >= -210 && uz <= 85) ||
      (ux >= -375 && ux <= -260 && uz >= -235 && uz <= -125);
    const skirtDepth = overUnderground && terrainY < 0.25 ? 0.28 : 8.5;
    const addSkirt = opts.yBase === undefined && opts.foundation !== false && skirtDepth > 0.5;
    const totalH = addSkirt ? h + skirtDepth : h;
    const centerY = addSkirt ? yBase + h * 0.5 - skirtDepth * 0.5 : yBase + h * 0.5;
    const matOpts = {
      studs: opts.studs ?? false,
      studStep: opts.studStep ?? 3.5,
      roughness: opts.roughness ?? 0.24,
      metalness: opts.metalness ?? 0.08
    };
    let mesh;
    if (!opts.studs) {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, totalH, d),
        getLegoMaterial(colorHex, matOpts)
      );
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
    } else {
      mesh = createLegoBrick(w, totalH, d, colorHex, matOpts);
    }
    mesh.position.set(x, centerY, z);
    this.scene.add(mesh);

    if (opts.collide !== false) {
      this.addCollider(x, z, w, d, yBase + h, addSkirt ? Math.max(0, yBase - skirtDepth) : yBase);
    }

    if (opts.registerMap !== false) {
      this.mapBuildings.push({
        x,
        z,
        w,
        d,
        height: h,
        color: opts.mapColor || `#${new THREE.Color(colorHex).getHexString()}`,
        label: opts.label || null
      });
    }

    return mesh;
  },

  createDetailedBuilding(x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) {
    return buildDetailedBuilding(this, x, z, w, h, d, styleKey, opts);
  },

  _buildUrbanDowntownBlock(bx, bz, W, D, layoutType, mainHeight, seed) {
    return buildUrbanDowntownBlock(this, bx, bz, W, D, layoutType, mainHeight, seed);
  },

  _createLegoCarMesh(cfg) {
    return createLegoCarMesh(cfg);
  },

  _addCityBlockSidewalk(x, z, w, d, colorHex = LEGO_COLORS.sidewalk, explicitYBase = undefined) {
    if (!this._sidewalkGeosByColor.has(colorHex)) {
      this._sidewalkGeosByColor.set(colorHex, []);
    }
    const geoBucket = this._sidewalkGeosByColor.get(colorHex);

    const minX = x - w * 0.5;
    const maxX = x + w * 0.5;
    const minZ = z - d * 0.5;
    const maxZ = z + d * 0.5;
    // Registro das calçadas (o resto da ilha é base de asfalto): usado para pilares/escadas do metrô
    if (!this.mapSidewalks) this.mapSidewalks = [];
    this.mapSidewalks.push({ minX, maxX, minZ, maxZ });

    const hitsCutout = METRO_ISLAND_CUTOUTS.some(
      (c) => c.maxX > minX && c.minX < maxX && c.maxZ > minZ && c.minZ < maxZ
    );

    if (hitsCutout) {
      const yBase = explicitYBase ?? 0;
      const pieces = sliceRectAroundCutouts({ minX, maxX, minZ, maxZ }, METRO_ISLAND_CUTOUTS);
      for (const r of pieces) {
        const pw = r.maxX - r.minX;
        const pd = r.maxZ - r.minZ;
        if (pw <= 0.02 || pd <= 0.02) continue;
        geoBucket.push(
          makeFastBox(pw, 0.28, pd, (r.minX + r.maxX) * 0.5, yBase + 0.14, (r.minZ + r.maxZ) * 0.5)
        );
      }
    } else if (explicitYBase !== undefined) {
      // Saia profunda de concreto (8.2m em ladeiras, 0.28m sobre subsolo plano) — nunca flutua em ladeiras!
      const overUnder =
        (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
        (x >= -375 && x <= -260 && z >= -235 && z <= -125);
      const slabH = overUnder && explicitYBase <= 0.2 ? 0.28 : 8.2;
      geoBucket.push(makeFastBox(w, slabH, d, x, explicitYBase + 0.28 - slabH * 0.5, z));
    } else {
      const yC = this.getTerrainHeightAt(x, z);
      const yNW = this.getTerrainHeightAt(minX, minZ);
      const yNE = this.getTerrainHeightAt(maxX, minZ);
      const ySW = this.getTerrainHeightAt(minX, maxZ);
      const ySE = this.getTerrainHeightAt(maxX, maxZ);
      const minCorner = Math.min(yC, yNW, yNE, ySW, ySE);
      const maxCorner = Math.max(yC, yNW, yNE, ySW, ySE);
      const overUnder =
        (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
        (x >= -375 && x <= -260 && z >= -235 && z <= -125);

      if (maxCorner - minCorner <= 0.16) {
        const slabH = overUnder && yC <= 0.2 ? 0.28 : 4.2;
        geoBucket.push(makeFastBox(w, slabH, d, x, yC + 0.28 - slabH * 0.5, z));
      } else {
        // Calçada orgânica subdividida acompanhando a ladeira + saia perimetral de 8.5m de profundidade!
        const segX = Math.max(3, Math.min(10, Math.round(w / 14)));
        const segZ = Math.max(3, Math.min(10, Math.round(d / 14)));
        const topGeo = new THREE.PlaneGeometry(w, d, segX, segZ);
        topGeo.rotateX(-Math.PI / 2);
        topGeo.translate(x, 0, z);
        const pos = topGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          pos.setY(i, this.getTerrainHeightAt(vx, vz) + 0.28);
        }
        topGeo.computeVertexNormals();
        geoBucket.push(topGeo);

        // 4 saias perimetrais de alicerce (8.5m para baixo) acompanhando cada borda do quarteirão!
        const skirtH = 8.5;
        const stepX = w / segX;
        for (let ix = 0; ix < segX; ix++) {
          const sx = minX + (ix + 0.5) * stepX;
          const yn = this.getTerrainHeightAt(sx, minZ) + 0.28;
          const ys = this.getTerrainHeightAt(sx, maxZ) + 0.28;
          geoBucket.push(
            makeFastBox(stepX + 0.08, skirtH, 1.2, sx, yn - skirtH * 0.5, minZ + 0.6),
            makeFastBox(stepX + 0.08, skirtH, 1.2, sx, ys - skirtH * 0.5, maxZ - 0.6)
          );
        }
        const stepZ = d / segZ;
        for (let iz = 0; iz < segZ; iz++) {
          const sz = minZ + (iz + 0.5) * stepZ;
          const yw = this.getTerrainHeightAt(minX, sz) + 0.28;
          const ye = this.getTerrainHeightAt(maxX, sz) + 0.28;
          geoBucket.push(
            makeFastBox(1.2, skirtH, stepZ + 0.08, minX + 0.6, yw - skirtH * 0.5, sz),
            makeFastBox(1.2, skirtH, stepZ + 0.08, maxX - 0.6, ye - skirtH * 0.5, sz)
          );
        }
      }
    }

    this.mapBlocks.push({
      x,
      z,
      w,
      d,
      color: `#${new THREE.Color(colorHex).getHexString()}`
    });
  },

  _finalizeMergedSidewalks() {
    if (this._sidewalkGeosByColor.size === 0) return;
    const mats = new Map();
    for (const colorHex of this._sidewalkGeosByColor.keys()) {
      mats.set(colorHex, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 }));
    }
    flushSpatialChunkedBuckets(this.scene, this._sidewalkGeosByColor, mats, {
      chunkSize: ws(512),
      castShadowFn: () => false,
      receiveShadowFn: () => true
    });
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

    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.52, 2.8, 8);
    trunkGeo.translate(0, 1.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.brown, roughness: 0.4 });
    const canopyGeo = new THREE.BoxGeometry(3.4, 3.2, 3.4);
    canopyGeo.translate(0, 3.8, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.35 });

    const treeChunk = ws(720);
    const chunks = new Map();
    for (let i = 0; i < count; i++) {
      const t = this._treeInstances[i];
      const key = `${Math.floor(t.x / treeChunk)},${Math.floor(t.z / treeChunk)}`;
      let bucket = chunks.get(key);
      if (!bucket) {
        bucket = [];
        chunks.set(key, bucket);
      }
      bucket.push(t);
    }

    const dummy = new THREE.Object3D();
    for (const bucket of chunks.values()) {
      const n = bucket.length;
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
      trunkInst.castShadow = false;
      trunkInst.receiveShadow = true;
      trunkInst.matrixAutoUpdate = false;

      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, n);
      canopyInst.castShadow = true;
      canopyInst.receiveShadow = true;
      canopyInst.matrixAutoUpdate = false;

      for (let i = 0; i < n; i++) {
        const t = bucket[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);
        canopyInst.setMatrixAt(i, dummy.matrix);
      }
      trunkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      trunkInst.updateMatrix();
      canopyInst.updateMatrix();

      this.scene.add(trunkInst, canopyInst);
    }
  },

  _initWaypointBeacon() {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.visible = false;

    const beamGeo = new THREE.CylinderGeometry(1.3, 1.3, 240, 16, 1, true);
    beamGeo.translate(0, 120, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.beaconBeam = new THREE.Mesh(beamGeo, beamMat);

    const coreGeo = new THREE.CylinderGeometry(0.45, 0.45, 240, 12, 1, true);
    coreGeo.translate(0, 120, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    this.beaconCore = new THREE.Mesh(coreGeo, coreMat);

    const ringGeo = new THREE.RingGeometry(2.2, 3.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    });
    this.beaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.beaconRing.position.y = 0.45;

    this.beaconGroup.add(this.beaconBeam, this.beaconCore, this.beaconRing);
    this.scene.add(this.beaconGroup);
  },

  setWaypoint(x, z, label = 'DESTINO MARCADO') {
    this.waypoint = { x, z, label };
    const wy = Math.max(0, this.getTerrainHeightAt(x, z));
    this.beaconGroup.position.set(x, wy, z);
    this.beaconGroup.visible = true;
    soundFX.playStudCollect(100);
  },

  clearWaypoint() {
    this.waypoint = null;
    this.beaconGroup.visible = false;
  },

  _setupSkyAndLights() {
    this.scene.background = new THREE.Color(0x0a101a);
    this.scene.fog = new THREE.FogExp2(0x0a101a, 0.00082);

    const hemiLight = new THREE.HemisphereLight(0x1f2d42, 0x05070c, 0.24);
    hemiLight.position.set(0, 480, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const sunLight = new THREE.DirectionalLight(0x6488a8, 0.48);
    sunLight.position.set(140, 260, 120);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 920;

    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.normalBias = 0.048;
    sunLight.shadow.bias = -0.0005;

    if (!this.waterShaderUniforms) {
      this.waterShaderUniforms = { uTime: { value: 0 } };
    }

    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;
  }
};
