import * as THREE from 'three';
import {
  markAsSharedAsset,
  DEFAULT_WHITE_COLOR,
  getSharedVertexColorMaterial,
  makeFastBox,
  makeTranslatedBox,
  mergeBufferGeometries,
  mergeColoredGeometries
} from './VertexColorBufferMerge.js';

export {
  markAsSharedAsset,
  getSharedVertexColorMaterial,
  makeFastBox,
  makeTranslatedBox,
  mergeBufferGeometries,
  mergeColoredGeometries
};

/**
 * Retorna a chave de chunk espacial `(cx, cz)` baseada no centroide X/Z da geometria.
 */
export function getGeometryChunkKey(geo, chunkSize = 512) {
  if (geo.isRawBox) {
    const cx = Math.floor(geo.x / chunkSize);
    const cz = Math.floor(geo.z / chunkSize);
    return `${cx},${cz}`;
  }
  const posAttr = geo.attributes.position;
  if (!posAttr || posAttr.count === 0) return '0,0';
  const arr = posAttr.array;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i];
    const z = arr[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const cx = Math.floor(((minX + maxX) * 0.5) / chunkSize);
  const cz = Math.floor(((minZ + maxZ) * 0.5) / chunkSize);
  return `${cx},${cz}`;
}

export function isOpaqueVertexColorableMaterial(mat, key = null, preserveKeys = null) {
  if (!mat || (preserveKeys && key !== null && preserveKeys.has(key))) return false;
  if (Array.isArray(mat)) return false;
  if (mat.transparent || mat.polygonOffset || mat.map || mat.emissiveMap || mat.alphaMap) return false;
  if (mat.isMeshBasicMaterial) return false;
  if (mat.userData?.isVehicleGlass || mat.userData?.isVehicleHeadlight) return false;
  if (mat.emissive && mat.emissive.getHex() !== 0 && (mat.emissiveIntensity ?? 0) > 0.001) return false;
  if ((mat.metalness ?? 0) > 0.45) return false;
  return true;
}

/**
 * Divide todos os buckets estáticos de uma região em Chunks Espaciais (padrão 512m x 512m)
 * para Frustum Culling + Shadow Culling eficientes na GPU e consolida materiais opacos via Vertex Colors!
 */
export function flushSpatialChunkedBuckets(scene, buckets, materials, opts = {}) {
  const chunkSize = opts.chunkSize ?? 512;
  const preserveKeys = opts.preserveKeys || null;
  const consolidateVertexColors = opts.consolidateVertexColors !== false;
  const castShadowFn =
    typeof opts.castShadowFn === 'function' ? opts.castShadowFn : () => false;
  const receiveShadowFn =
    typeof opts.receiveShadowFn === 'function'
      ? opts.receiveShadowFn
      : (_key, mat) => !mat?.isMeshBasicMaterial;

  const getMat = (key) =>
    materials instanceof Map ? materials.get(key) : materials[key];

  const vcGroups = new Map();

  for (const [key, geos] of buckets.entries()) {
    if (!geos || geos.length === 0) continue;
    const mat = getMat(key);
    if (!mat) continue;

    const castShadow = Boolean(castShadowFn(key, mat));
    const receiveShadow = Boolean(receiveShadowFn(key, mat));
    const canConsolidate =
      consolidateVertexColors && isOpaqueVertexColorableMaterial(mat, key, preserveKeys);

    if (canConsolidate) {
      const roughBand = (mat.roughness ?? 0.35) >= 0.42 ? 1 : 0;
      const col = mat.color || DEFAULT_WHITE_COLOR;
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i];
        const cKey = getGeometryChunkKey(g, chunkSize);
        const bucketId = `${cKey}|${castShadow ? 1 : 0}|${receiveShadow ? 1 : 0}|${roughBand}`;
        let group = vcGroups.get(bucketId);
        if (!group) {
          group = {
            castShadow,
            receiveShadow,
            roughness: roughBand ? 0.54 : 0.25,
            metalness: 0.04,
            entries: [],
            singleMats: new Set()
          };
          vcGroups.set(bucketId, group);
        }
        group.entries.push({ geo: g, color: col });
        group.singleMats.add(mat);
      }
      geos.length = 0;
    } else {
      const byChunk = new Map();
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i];
        const cKey = getGeometryChunkKey(g, chunkSize);
        let list = byChunk.get(cKey);
        if (!list) {
          list = [];
          byChunk.set(cKey, list);
        }
        list.push(g);
      }
      for (const cList of byChunk.values()) {
        if (cList.length === 0) continue;
        const merged = mergeBufferGeometries(cList);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        scene.add(mesh);
      }
      geos.length = 0;
    }
  }

  for (const grp of vcGroups.values()) {
    if (grp.entries.length === 0) continue;
    let mesh;
    if (grp.singleMats.size === 1) {
      const onlyMat = grp.singleMats.values().next().value;
      const rawGeos = grp.entries.map((e) => e.geo);
      mesh = new THREE.Mesh(mergeBufferGeometries(rawGeos), onlyMat);
    } else {
      const mergedGeo = mergeColoredGeometries(grp.entries);
      const vcMat = getSharedVertexColorMaterial({
        roughness: grp.roughness,
        metalness: grp.metalness,
        clearcoat: 0.06,
        clearcoatRoughness: 0.46
      });
      mesh = new THREE.Mesh(mergedGeo, vcMat);
    }
    mesh.castShadow = grp.castShadow;
    mesh.receiveShadow = grp.receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
  }
}

/**
 * Funde todas as malhas estáticas filhas de um Group (ex.: carro, barco, avião, helicóptero)
 * agrupando por Material, preservando intactos os subgrupos animados (rodas, hélices, chamas de turbo).
 * Reduz cada veículo de ~28 Draw Calls para ~4 Draw Calls!
 */
export function optimizeStaticGroupMeshes(rootGroup, animatedObjects = []) {
  if (!rootGroup || rootGroup.userData?.isOptimizedGroup) return rootGroup;
  rootGroup.userData.isOptimizedGroup = true;

  const preservedSet = new Set();
  for (const obj of animatedObjects) {
    if (!obj) continue;
    obj.traverse((child) => {
      preservedSet.add(child);
      if (child.isMesh) {
        child.castShadow = false;
      }
    });
  }

  rootGroup.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(rootGroup.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4();
  const instMatrix = new THREE.Matrix4();
  const finalInstMatrix = new THREE.Matrix4();

  const geosByMat = new Map();
  const matFlags = new Map();
  const meshesToRemove = [];

  rootGroup.traverse((child) => {
    if (child === rootGroup || preservedSet.has(child)) return;

    if (child.isInstancedMesh && child.geometry && child.material) {
      if (child.count <= 96) {
        relMatrix.multiplyMatrices(rootInverse, child.matrixWorld);
        if (!geosByMat.has(child.material)) {
          geosByMat.set(child.material, []);
        }
        const bucket = geosByMat.get(child.material);
        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, instMatrix);
          finalInstMatrix.multiplyMatrices(relMatrix, instMatrix);
          const g = child.geometry.clone();
          g.applyMatrix4(finalInstMatrix);
          bucket.push(g);
        }
        meshesToRemove.push(child);
      } else {
        child.castShadow = false;
      }
      return;
    }

    if (!child.isMesh || !child.geometry || !child.material) return;

    relMatrix.multiplyMatrices(rootInverse, child.matrixWorld);
    const clonedGeo = child.geometry.clone();
    clonedGeo.applyMatrix4(relMatrix);
    if (!geosByMat.has(child.material)) {
      geosByMat.set(child.material, []);
    }
    if (child.userData?.isVehicleGlass || child.userData?.isVehicleHeadlight) {
      const prev = matFlags.get(child.material) || {};
      if (child.userData.isVehicleGlass) prev.isVehicleGlass = true;
      if (child.userData.isVehicleHeadlight) prev.isVehicleHeadlight = true;
      matFlags.set(child.material, prev);
    }
    geosByMat.get(child.material).push(clonedGeo);
    meshesToRemove.push(child);
  });

  for (const m of meshesToRemove) {
    if (m.parent) m.parent.remove(m);
  }

  const pruneEmptySubgroups = (node) => {
    for (let i = node.children.length - 1; i >= 0; i--) {
      const ch = node.children[i];
      if (preservedSet.has(ch)) continue;
      pruneEmptySubgroups(ch);
      if (!ch.isMesh && !ch.isLight && !ch.isPoints && !ch.isLine && ch.children.length === 0) {
        node.remove(ch);
      }
    }
  };
  pruneEmptySubgroups(rootGroup);

  const vcBuckets = new Map();

  for (const [mat, geos] of geosByMat.entries()) {
    if (geos.length === 0) continue;
    const flags = matFlags.get(mat);
    const canConsolidate =
      !mat.transparent &&
      !mat.isMeshBasicMaterial &&
      !mat.polygonOffset &&
      !mat.map &&
      !mat.emissiveMap &&
      !mat.alphaMap &&
      !flags?.isVehicleGlass &&
      !flags?.isVehicleHeadlight &&
      !mat.userData?.isVehicleGlass &&
      !mat.userData?.isVehicleHeadlight &&
      (!mat.emissive || mat.emissive.getHex() === 0 || (mat.emissiveIntensity ?? 0) <= 0.001);

    if (canConsolidate) {
      const mBucket = Math.round((mat.metalness ?? 0) * 2);
      const rBucket = (mat.roughness ?? 0.25) >= 0.42 ? 1 : 0;
      const cBucket = (mat.clearcoat ?? 0.4) > 0.15 ? 1 : 0;
      const bKey = `${mBucket}|${rBucket}|${cBucket}`;
      let grp = vcBuckets.get(bKey);
      if (!grp) {
        grp = { mat, mats: new Set(), entries: [] };
        vcBuckets.set(bKey, grp);
      }
      grp.mats.add(mat);
      const col = mat.color || DEFAULT_WHITE_COLOR;
      for (let i = 0; i < geos.length; i++) {
        grp.entries.push({ geo: geos[i], color: col });
      }
      continue;
    }

    const mergedGeo = mergeBufferGeometries(geos);
    const mergedMesh = new THREE.Mesh(mergedGeo, mat);
    mergedMesh.castShadow = !mat.transparent && !mat.isMeshBasicMaterial;
    mergedMesh.receiveShadow = true;
    if (flags) {
      Object.assign(mergedMesh.userData, flags);
    }
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.updateMatrix();
    rootGroup.add(mergedMesh);
  }

  for (const grp of vcBuckets.values()) {
    if (grp.entries.length === 0) continue;
    let mergedMesh;
    if (grp.mats.size === 1) {
      const onlyMat = grp.mats.values().next().value;
      const rawGeos = grp.entries.map((e) => e.geo);
      mergedMesh = new THREE.Mesh(mergeBufferGeometries(rawGeos), onlyMat);
    } else {
      const mergedGeo = mergeColoredGeometries(grp.entries);
      const ref = grp.mat;
      const vcMat = getSharedVertexColorMaterial({
        roughness: ref.roughness ?? 0.25,
        metalness: ref.metalness ?? 0.08,
        clearcoat: ref.clearcoat ?? 0.4,
        clearcoatRoughness: ref.clearcoatRoughness ?? 0.22
      });
      mergedMesh = new THREE.Mesh(mergedGeo, vcMat);
    }
    mergedMesh.castShadow = true;
    mergedMesh.receiveShadow = true;
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.updateMatrix();
    rootGroup.add(mergedMesh);
  }

  return rootGroup;
}
