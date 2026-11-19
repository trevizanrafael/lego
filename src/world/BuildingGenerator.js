import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../materials/LegoMaterials.js';
export { markAsSharedAsset };

// Geometria-base estática 1x1x1 para `makeTranslatedBox` ultrarrápido sem alocar BoxGeometry/Vector3/Matrix4 por bloco
const _UNIT_BOX_SRC = new THREE.BoxGeometry(1, 1, 1);
const _UNIT_BOX_POS = _UNIT_BOX_SRC.attributes.position.array;
const _UNIT_BOX_NORM = _UNIT_BOX_SRC.attributes.normal.array;
const _UNIT_BOX_UV = _UNIT_BOX_SRC.attributes.uv.array;
const _UNIT_BOX_IDX = _UNIT_BOX_SRC.index.array;
_UNIT_BOX_SRC.dispose();

const _DEFAULT_WHITE_COLOR = new THREE.Color(0xffffff);
const _VC_MAT_CACHE = new Map();

/**
 * Retorna um MeshPhysicalMaterial compartilhado com `vertexColors: true` (marcado como asset compartilhado
 * para zero shader recompiles e zero leaks em objetos transientes).
 */
export function getSharedVertexColorMaterial(opts = {}) {
  const roughness = Number((opts.roughness ?? 0.62).toFixed(2));
  const metalness = Number((opts.metalness ?? 0.08).toFixed(2));
  const clearcoat = Number((opts.clearcoat ?? 0.06).toFixed(2));
  const clearcoatRoughness = Number((opts.clearcoatRoughness ?? 0.46).toFixed(2));
  const emissiveHex = opts.emissive ? new THREE.Color(opts.emissive).getHex() : 0;
  const emissiveIntensity = emissiveHex ? Number((opts.emissiveIntensity ?? 0).toFixed(2)) : 0;
  const key = `${roughness}|${metalness}|${clearcoat}|${clearcoatRoughness}|${emissiveHex}|${emissiveIntensity}`;
  let mat = _VC_MAT_CACHE.get(key);
  if (mat) return mat;
  mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    emissive: emissiveHex,
    emissiveIntensity
  });
  markAsSharedAsset(mat);
  _VC_MAT_CACHE.set(key, mat);
  return mat;
}

/**
 * Descritor leve de bloco sem alocação de BufferGeometry/BufferAttribute/UUID por tijolo.
 * Consumido diretamente por `mergeBufferGeometries`, `mergeColoredGeometries` e `getGeometryChunkKey`.
 */
export function makeFastBox(w, h, d, x, y, z) {
  return { isRawBox: true, w, h, d, x, y, z };
}

function _writeRawBoxIntoArrays(box, positions, normals, uvs, indices, vOffset, iOffset) {
  const { w, h, d, x, y, z } = box;
  const pStart = vOffset * 3;
  for (let i = 0; i < 72; i += 3) {
    positions[pStart + i] = _UNIT_BOX_POS[i] * w + x;
    positions[pStart + i + 1] = _UNIT_BOX_POS[i + 1] * h + y;
    positions[pStart + i + 2] = _UNIT_BOX_POS[i + 2] * d + z;
  }
  normals.set(_UNIT_BOX_NORM, pStart);
  if (uvs) uvs.set(_UNIT_BOX_UV, vOffset * 2);
  if (indices) {
    for (let i = 0; i < 36; i++) {
      indices[iOffset + i] = _UNIT_BOX_IDX[i] + vOffset;
    }
  }
}

/**
 * Une um array de BufferGeometries (ou descritores `makeFastBox`) em uma única BufferGeometry
 * (Suporta position, normal, uv e vertex color!)
 */
export function mergeBufferGeometries(geometries) {
  if (!geometries || geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1 && !geometries[0].isRawBox) return geometries[0];

  let totalVerts = 0;
  let totalIndices = 0;
  let hasAnyIndexed = false;
  let anyUv = false;
  let anyColor = false;
  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    if (g.isRawBox || g.index) {
      hasAnyIndexed = true;
      break;
    }
  }
  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    if (g.isRawBox) {
      totalVerts += 24;
      totalIndices += 36;
      anyUv = true;
    } else {
      const c = g.attributes.position.count;
      totalVerts += c;
      if (g.index) totalIndices += g.index.count;
      else if (hasAnyIndexed) totalIndices += c;
      if (g.attributes.uv) anyUv = true;
      if (g.attributes.color) anyColor = true;
    }
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = anyUv ? new Float32Array(totalVerts * 2) : null;
  const colors = anyColor ? new Float32Array(totalVerts * 3) : null;
  const indices = totalIndices > 0 ? new Uint32Array(totalIndices) : null;

  let vOffset = 0;
  let iOffset = 0;

  for (let gi = 0; gi < geometries.length; gi++) {
    const g = geometries[gi];
    if (g.isRawBox) {
      _writeRawBoxIntoArrays(g, positions, normals, uvs, indices, vOffset, iOffset);
      if (colors) {
        const end = (vOffset + 24) * 3;
        for (let ci = vOffset * 3; ci < end; ci++) colors[ci] = 1.0;
      }
      vOffset += 24;
      iOffset += 36;
      continue;
    }

    const posAttr = g.attributes.position;
    const count = posAttr.count;
    positions.set(posAttr.array, vOffset * 3);

    const normAttr = g.attributes.normal;
    if (normAttr) {
      normals.set(normAttr.array, vOffset * 3);
    }
    if (uvs && g.attributes.uv) {
      uvs.set(g.attributes.uv.array, vOffset * 2);
    }
    if (colors) {
      const colAttr = g.attributes.color;
      if (colAttr) {
        colors.set(colAttr.array, vOffset * 3);
      } else {
        const end = (vOffset + count) * 3;
        for (let ci = vOffset * 3; ci < end; ci++) colors[ci] = 1.0;
      }
    }

    if (indices) {
      if (g.index) {
        const idxArray = g.index.array;
        for (let i = 0; i < idxArray.length; i++) {
          indices[iOffset + i] = idxArray[i] + vOffset;
        }
        iOffset += idxArray.length;
      } else {
        for (let i = 0; i < count; i++) {
          indices[iOffset + i] = vOffset + i;
        }
        iOffset += count;
      }
    }

    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (indices) {
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  return merged;
}

/**
 * Mescla várias geometrias coloridas (ou `makeFastBox`) em 1 única BufferGeometry usando Vertex Colors,
 * reduzindo dezenas de Draw Calls de peças opacas coloridas a 1 único Draw Call!
 */
export function mergeColoredGeometries(coloredGeos) {
  if (!coloredGeos || coloredGeos.length === 0) return new THREE.BufferGeometry();

  let totalVerts = 0;
  let totalIndices = 0;
  let hasAnyIndexed = false;
  let anyUv = false;
  for (let i = 0; i < coloredGeos.length; i++) {
    const g = coloredGeos[i].geo;
    if (g.isRawBox || g.index) {
      hasAnyIndexed = true;
      break;
    }
  }
  for (let i = 0; i < coloredGeos.length; i++) {
    const g = coloredGeos[i].geo;
    if (g.isRawBox) {
      totalVerts += 24;
      totalIndices += 36;
      anyUv = true;
    } else {
      const c = g.attributes.position.count;
      totalVerts += c;
      if (g.index) totalIndices += g.index.count;
      else if (hasAnyIndexed) totalIndices += c;
      if (g.attributes.uv) anyUv = true;
    }
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const uvs = anyUv ? new Float32Array(totalVerts * 2) : null;
  const indices = totalIndices > 0 ? new Uint32Array(totalIndices) : null;

  let vOffset = 0;
  let iOffset = 0;

  for (let gi = 0; gi < coloredGeos.length; gi++) {
    const entry = coloredGeos[gi];
    const g = entry.geo;
    const c = entry.color || _DEFAULT_WHITE_COLOR;
    const r = c.r;
    const gr = c.g;
    const b = c.b;

    if (g.isRawBox) {
      _writeRawBoxIntoArrays(g, positions, normals, uvs, indices, vOffset, iOffset);
      const start3 = vOffset * 3;
      for (let k = 0; k < 72; k += 3) {
        colors[start3 + k] = r;
        colors[start3 + k + 1] = gr;
        colors[start3 + k + 2] = b;
      }
      vOffset += 24;
      iOffset += 36;
      continue;
    }

    const posAttr = g.attributes.position;
    const count = posAttr.count;

    positions.set(posAttr.array, vOffset * 3);
    if (g.attributes.normal) {
      normals.set(g.attributes.normal.array, vOffset * 3);
    }
    if (uvs && g.attributes.uv) {
      uvs.set(g.attributes.uv.array, vOffset * 2);
    }

    const existingCol = g.attributes.color;
    const start3 = vOffset * 3;
    if (existingCol) {
      const arr = existingCol.array;
      for (let k = 0; k < count * 3; k += 3) {
        colors[start3 + k] = arr[k] * r;
        colors[start3 + k + 1] = arr[k + 1] * gr;
        colors[start3 + k + 2] = arr[k + 2] * b;
      }
    } else {
      for (let k = 0; k < count * 3; k += 3) {
        colors[start3 + k] = r;
        colors[start3 + k + 1] = gr;
        colors[start3 + k + 2] = b;
      }
    }

    if (indices) {
      if (g.index) {
        const idxArray = g.index.array;
        for (let i = 0; i < idxArray.length; i++) {
          indices[iOffset + i] = idxArray[i] + vOffset;
        }
        iOffset += idxArray.length;
      } else {
        for (let i = 0; i < count; i++) {
          indices[iOffset + i] = vOffset + i;
        }
        iOffset += count;
      }
    }

    vOffset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (uvs) merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

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
 * Divide todos os buckets estáticos de uma região em Chunks Espaciais (padrão 256m x 256m)
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
      const col = mat.color || _DEFAULT_WHITE_COLOR;
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
 * Helper ultrarrápido para criar uma BoxGeometry já escalada e transladada para (x, y, z) pronta para merge
 */
export function makeTranslatedBox(w, h, d, x, y, z) {
  const pos = new Float32Array(72);
  const norm = new Float32Array(_UNIT_BOX_NORM);
  const uv = new Float32Array(_UNIT_BOX_UV);
  for (let i = 0; i < 72; i += 3) {
    pos[i] = _UNIT_BOX_POS[i] * w + x;
    pos[i + 1] = _UNIT_BOX_POS[i + 1] * h + y;
    pos[i + 2] = _UNIT_BOX_POS[i + 2] * d + z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(_UNIT_BOX_IDX), 1));
  return geo;
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
      const col = mat.color || _DEFAULT_WHITE_COLOR;
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

/**
 * Catálogo dos 8 Estilos Arquitetônicos de Edifícios do Centro Metropolitano
 */
export const BUILDING_STYLES = {
  sapphire_glass: {
    name: 'Vidro Azul-Abissal Gotham',
    wallHex: 0x09192e,
    bgColor: '#071324',
    spandrelColor: '#10243e',
    mullionColor: '#475569',
    pillarHex: 0x334155,
    corniceHex: 0x1e293b,
    baseHex: 0x090d16,
    parapetHex: 0x1e293b,
    mapColor: '#1e3a5f',
    litColors: ['#fde68a', '#f59e0b', '#7dd3fc'],
    darkWinColor: '#040a14',
    roughness: 0.22,
    metalness: 0.36,
    awningHex: 0x1e3a5f
  },
  cyan_modern: {
    name: 'Vidro Noturno Petróleo',
    wallHex: 0x06202b,
    bgColor: '#051922',
    spandrelColor: '#0b3b49',
    mullionColor: '#386675',
    pillarHex: 0x182230,
    corniceHex: 0x155e75,
    baseHex: 0x070a11,
    parapetHex: 0x0f3b4c,
    mapColor: '#0e7490',
    litColors: ['#a5f3fc', '#fde68a', '#38bdf8'],
    darkWinColor: '#031017',
    roughness: 0.2,
    metalness: 0.38,
    awningHex: 0x155e75
  },
  white_concrete: {
    name: 'Calcário Cinza-Fuligem Brutalista',
    wallHex: 0x646e7d,
    bgColor: '#56606e',
    spandrelColor: '#3b434f',
    mullionColor: '#7c8798',
    pillarHex: 0x5b6472,
    corniceHex: 0x323946,
    baseHex: 0x1b202b,
    parapetHex: 0x4b5463,
    mapColor: '#64748b',
    litColors: ['#fbbf24', '#f59e0b', '#fef3c7'],
    darkWinColor: '#0e131b',
    roughness: 0.56,
    metalness: 0.1,
    awningHex: 0x7f1d1d
  },
  ny_brick: {
    name: 'Tijolo Escuro Fuligem Gotham',
    wallHex: 0x4a1d12,
    bgColor: '#3d170e',
    spandrelColor: '#260e08',
    mullionColor: '#78716c',
    pillarHex: 0x572215,
    corniceHex: 0x44403c,
    baseHex: 0x171412,
    parapetHex: 0x3b160e,
    mapColor: '#7c2d12',
    litColors: ['#f59e0b', '#fbbf24', '#fed7aa'],
    darkWinColor: '#110d0c',
    roughness: 0.62,
    metalness: 0.06,
    awningHex: 0x143828
  },
  black_granite_gold: {
    name: 'Obsidiana Art-Deco & Latão Velho',
    wallHex: 0x0b0e15,
    bgColor: '#080b11',
    spandrelColor: '#141923',
    mullionColor: '#b47b12',
    pillarHex: 0x151922,
    corniceHex: 0xb47b12,
    baseHex: 0x05070b,
    parapetHex: 0x151922,
    mapColor: '#1f2937',
    litColors: ['#fbbf24', '#d97706', '#fde68a'],
    darkWinColor: '#030408',
    roughness: 0.24,
    metalness: 0.36,
    awningHex: 0x92600a
  },
  classic_sandstone: {
    name: 'Brownstone Envelhecido Sombrio',
    wallHex: 0x5c4f42,
    bgColor: '#4f4338',
    spandrelColor: '#382f27',
    mullionColor: '#8c7d6e',
    pillarHex: 0x695a4c,
    corniceHex: 0x2e2722,
    baseHex: 0x1c1815,
    parapetHex: 0x4f4338,
    mapColor: '#57534e',
    litColors: ['#fbbf24', '#f59e0b', '#fde68a'],
    darkWinColor: '#14110f',
    roughness: 0.58,
    metalness: 0.08,
    awningHex: 0x7f1d1d
  },
  emerald_steel: {
    name: 'Aço Oxidado Verde-Abissal',
    wallHex: 0x052e24,
    bgColor: '#04221b',
    spandrelColor: '#064032',
    mullionColor: '#367563',
    pillarHex: 0x1f2937,
    corniceHex: 0x0f5241,
    baseHex: 0x090f17,
    parapetHex: 0x063b2e,
    mapColor: '#065f46',
    litColors: ['#a7f3d0', '#fde68a', '#6ee7b7'],
    darkWinColor: '#021510',
    roughness: 0.24,
    metalness: 0.34,
    awningHex: 0x065f46
  },
  silver_corporate: {
    name: 'Titânio Escovado & Chumbo',
    wallHex: 0x475569,
    bgColor: '#374354',
    spandrelColor: '#1e2633',
    mullionColor: '#7c8b9e',
    pillarHex: 0x4b596e,
    corniceHex: 0x151b26,
    baseHex: 0x0d121a,
    parapetHex: 0x3b4759,
    mapColor: '#475569',
    litColors: ['#e2e8f0', '#fbbf24', '#93c5fd'],
    darkWinColor: '#080c14',
    roughness: 0.32,
    metalness: 0.4,
    awningHex: 0x1e3a5f
  }
};

export const BUILDING_STYLE_KEYS = Object.keys(BUILDING_STYLES);

const FACADE_MATERIAL_CACHE = new Map();
const TRIM_MATERIAL_CACHE = new Map();

function getFastStandardMaterial(colorHex, roughness = 0.28, metalness = 0.15) {
  const key = `${colorHex}_${roughness}_${metalness}`;
  if (TRIM_MATERIAL_CACHE.has(key)) return TRIM_MATERIAL_CACHE.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness,
    metalness,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  markAsSharedAsset(mat);
  TRIM_MATERIAL_CACHE.set(key, mat);
  return mat;
}

export function getCachedFacadeMaterials() {
  return Array.from(FACADE_MATERIAL_CACHE.values());
}

export function getFacadeMaterial(styleKey, seedVariant = 0) {
  const style = BUILDING_STYLES[styleKey] || BUILDING_STYLES.sapphire_glass;
  const cacheKey = `${styleKey}_${seedVariant % 3}`;
  if (FACADE_MATERIAL_CACHE.has(cacheKey)) {
    return FACADE_MATERIAL_CACHE.get(cacheKey);
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Segundo canvas exclusivo para emissiveMap (apenas retângulos de janelas acesas isLit sobre #000000!)
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = 256;
  emissiveCanvas.height = 512;
  const ectx = emissiveCanvas.getContext('2d');

  ctx.fillStyle = style.bgColor;
  ctx.fillRect(0, 0, 256, 512);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 256, 512);

  const cols = 4;
  const rows = 8;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * cellH;
    ctx.fillStyle = style.spandrelColor;
    ctx.fillRect(0, y, 256, 12);

    ctx.fillStyle = style.mullionColor;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(0, y + 9, 256, 3);
    ctx.globalAlpha = 1;

    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      ctx.fillStyle = style.mullionColor;
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, y, 6, cellH);
      ctx.globalAlpha = 1;

      const hash = ((r * 17 + c * 31 + seedVariant * 13) * 2654435761) >>> 0;
      const isLit = (hash % 10) < 4;
      const winX = x + 9;
      const winY = y + 16;
      const winW = cellW - 14;
      const winH = cellH - 22;

      if (isLit) {
        const litColor = style.litColors[hash % style.litColors.length];
        ctx.fillStyle = '#05070c';
        ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);
        ctx.fillStyle = litColor;
        ctx.fillRect(winX, winY, winW, winH);
        ctx.fillStyle = 'rgba(255, 251, 235, 0.72)';
        ctx.fillRect(winX + 2, winY + 2, winW - 4, 5);
        // Sombra interna de persiana / caixilho Art-Deco
        ctx.fillStyle = 'rgba(8, 10, 16, 0.38)';
        ctx.fillRect(winX, winY + (winH >> 1), winW, 2);

        ectx.fillStyle = litColor;
        ectx.fillRect(winX, winY, winW, winH);
        ectx.fillStyle = '#fffbeb';
        ectx.fillRect(winX + 2, winY + 2, winW - 4, 5);
      } else {
        ctx.fillStyle = '#04060a';
        ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);
        ctx.fillStyle = style.darkWinColor;
        ctx.fillRect(winX, winY, winW, winH);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.09)';
        ctx.fillRect(winX + 3, winY + 3, 8, winH - 6);
      }
    }
  }

  // Fuligem urbana / escorrido de chuva ácido sutil nas fachadas Gotham (sem afetar emissiveMap)
  if (typeof ctx.createLinearGradient === 'function') {
    const sootTop = ctx.createLinearGradient(0, 0, 0, 96);
    sootTop.addColorStop(0, 'rgba(4, 6, 10, 0.42)');
    sootTop.addColorStop(1, 'rgba(4, 6, 10, 0)');
    ctx.fillStyle = sootTop;
    ctx.fillRect(0, 0, 256, 96);

    const sootBot = ctx.createLinearGradient(0, 400, 0, 512);
    sootBot.addColorStop(0, 'rgba(4, 6, 10, 0)');
    sootBot.addColorStop(1, 'rgba(4, 6, 10, 0.46)');
    ctx.fillStyle = sootBot;
    ctx.fillRect(0, 400, 256, 112);
  }
  ctx.fillStyle = 'rgba(5, 7, 12, 0.16)';
  for (let sx = 12; sx < 256; sx += 29) {
    const streakLen = 70 + ((sx * 37 + seedVariant * 19) % 190);
    ctx.fillRect(sx, 0, 2, streakLen);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  markAsSharedAsset(tex);

  const emissiveTex = new THREE.CanvasTexture(emissiveCanvas);
  emissiveTex.colorSpace = THREE.SRGBColorSpace;
  emissiveTex.generateMipmaps = true;
  emissiveTex.wrapS = THREE.RepeatWrapping;
  emissiveTex.wrapT = THREE.RepeatWrapping;
  emissiveTex.minFilter = THREE.LinearMipmapLinearFilter;
  emissiveTex.magFilter = THREE.LinearFilter;
  emissiveTex.anisotropy = 8;
  emissiveTex.needsUpdate = true;
  markAsSharedAsset(emissiveTex);

  // MeshPhysicalMaterial com emissiveMap + clearcoat garante reflexos vitrificados de dia e janelas acesas à noite!
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: emissiveTex,
    emissiveIntensity: 0.0,
    roughness: style.roughness,
    metalness: style.metalness,
    clearcoat: style.roughness < 0.35 ? 0.65 : 0.22,
    clearcoatRoughness: 0.1,
    reflectivity: 0.78
  });
  markAsSharedAsset(mat);

  FACADE_MATERIAL_CACHE.set(cacheKey, mat);
  return mat;
}

/**
 * Constrói e registra um Edifício Detalhado OTIMIZADO (Apenas 2 a 3 Draw Calls por edifício em vez de 31!):
 * - Todas as colunas de quina, cornijas horizontais, muretas do topo, casinha de acesso e HVAC são fundidas em 1 única malha (`trimMesh`)!
 */
export function buildDetailedBuilding(world, x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) {
  const style = BUILDING_STYLES[styleKey] || BUILDING_STYLES.sapphire_glass;
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = opts.yBase ?? (terrainY + 0.28);
  const seed = opts.seed ?? Math.abs(Math.round(x * 7 + z * 13 + h * 3));
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.userData = { isDetailedBuilding: true, styleKey, height: h, width: w, depth: d };

  // 1. Corpo Principal com Silhueta Art-Deco / Brutalista Escalonada (Setbacks sem faces coplanares — 1 único Draw Call!)
  const facadeMat = getFacadeMaterial(styleKey, seed);
  const useArtDecoSetbacks =
    opts.rooftop !== false && h >= 44 && w >= 15 && d >= 15 && (seed % 4 !== 3);
  let bodyGeo;
  let topCrownW = w;
  let topCrownD = d;
  let tier1H = h;
  let tier2TopY = h;

  if (useArtDecoSetbacks) {
    tier1H = Math.round(h * 0.74 * 10) / 10;
    const tier2H = Math.round(h * 0.16 * 10) / 10;
    const tier3H = Math.max(2.5, h - tier1H - tier2H);
    tier2TopY = tier1H + tier2H;
    const w2 = w * 0.82;
    const d2 = d * 0.82;
    topCrownW = w * 0.64;
    topCrownD = d * 0.64;

    const g1 = makeTranslatedBox(w, tier1H, d, 0, tier1H * 0.5, 0);
    const g2 = makeTranslatedBox(w2, tier2H, d2, 0, tier1H + tier2H * 0.5, 0);
    const g3 = makeTranslatedBox(topCrownW, tier3H, topCrownD, 0, tier2TopY + tier3H * 0.5, 0);
    bodyGeo = mergeBufferGeometries([g1, g2, g3]);
    g1.dispose();
    g2.dispose();
    g3.dispose();
  } else {
    bodyGeo = makeTranslatedBox(w, h, d, 0, h * 0.5, 0);
  }

  const bodyMesh = new THREE.Mesh(bodyGeo, facadeMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Geometria Mesclada de Acabamento Arquitetônico Art-Deco / Brutalista (Contrafortes chanfrados 45°, cornijas e reservatório cônico!)
  const overUndergroundZone =
    (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
    (x >= -375 && x <= -260 && z >= -235 && z <= -125);
  const skirtDepth = overUndergroundZone && terrainY < 0.2 ? 0.3 : 8.5;
  const trimGeos = [];
  if (opts.groundFloor !== false && opts.foundation !== false) {
    trimGeos.push(makeTranslatedBox(w + 0.65, skirtDepth, d + 0.65, 0, -skirtDepth * 0.5 + 0.08, 0));
  }

  // Pilares de Quina Chanfrados em 45° (quebra a quina 90° de caixa de sapato!)
  const pSize = 1.48;
  const shaftH = useArtDecoSetbacks ? tier1H : h;
  const cornerOffsets = [
    [-w * 0.5 + 0.22, -d * 0.5 + 0.22],
    [w * 0.5 - 0.22, -d * 0.5 + 0.22],
    [-w * 0.5 + 0.22, d * 0.5 - 0.22],
    [w * 0.5 - 0.22, d * 0.5 - 0.22]
  ];
  for (const [cx, cz] of cornerOffsets) {
    const chamferCol = new THREE.BoxGeometry(pSize, shaftH, pSize);
    chamferCol.rotateY(Math.PI / 4);
    chamferCol.translate(cx, shaftH * 0.5, cz);
    trimGeos.push(chamferCol);
  }

  // Aletas Verticais Brutalistas nas Fachadas (Fins)
  if (w >= 18 && d >= 18) {
    trimGeos.push(
      makeTranslatedBox(0.75, shaftH, d + 0.72, 0, shaftH * 0.5, 0),
      makeTranslatedBox(w + 0.72, shaftH, 0.75, 0, shaftH * 0.5, 0)
    );
  }

  // Cornijas horizontais pesadas no fuste principal + cornijas nos degraus Art-Deco
  for (let cy = 22; cy < shaftH - 4; cy += 28) {
    trimGeos.push(makeTranslatedBox(w + 1.05, 0.95, d + 1.05, 0, cy, 0));
  }
  if (useArtDecoSetbacks) {
    trimGeos.push(
      makeTranslatedBox(w + 1.25, 1.15, d + 1.25, 0, tier1H, 0),
      makeTranslatedBox(w * 0.82 + 1.05, 0.95, d * 0.82 + 1.05, 0, tier2TopY, 0)
    );
  }

  // Topo do Prédio (Mureta na coroa + Casa de Máquinas + Caixa d'Água Cônica estilo Gotham/NY + Pináculo Gótico-Industrial!)
  if (opts.rooftop !== false) {
    const parapetH = 1.55;
    const parapetThick = 1.15;
    const cw = topCrownW;
    const cd = topCrownD;
    trimGeos.push(
      makeTranslatedBox(cw, parapetH, parapetThick, 0, h + parapetH * 0.5, -cd * 0.5 + parapetThick * 0.5),
      makeTranslatedBox(cw, parapetH, parapetThick, 0, h + parapetH * 0.5, cd * 0.5 - parapetThick * 0.5),
      makeTranslatedBox(parapetThick, parapetH, Math.max(0.8, cd - parapetThick * 2), -cw * 0.5 + parapetThick * 0.5, h + parapetH * 0.5, 0),
      makeTranslatedBox(parapetThick, parapetH, Math.max(0.8, cd - parapetThick * 2), cw * 0.5 - parapetThick * 0.5, h + parapetH * 0.5, 0)
    );

    if (w >= 14 && d >= 14) {
      trimGeos.push(
        makeTranslatedBox(Math.min(4.2, cw * 0.34), 3.4, Math.min(4.6, cd * 0.36), -cw * 0.2, h + 1.7, -cd * 0.18),
        makeTranslatedBox(Math.min(3.6, cw * 0.3), 1.9, Math.min(3.0, cd * 0.28), cw * 0.18, h + 0.95, -cd * 0.2)
      );

      // Reservatório Cilíndrico com Teto Cônico (Ícone Clássico de Gotham / Nova York!)
      const wtX = cw * 0.2;
      const wtZ = cd * 0.18;
      const wtBarrel = new THREE.CylinderGeometry(1.65, 1.65, 3.1, 10);
      wtBarrel.translate(wtX, h + 3.4, wtZ);
      const wtCone = new THREE.ConeGeometry(1.88, 1.35, 10);
      wtCone.translate(wtX, h + 5.6, wtZ);
      trimGeos.push(
        wtBarrel,
        wtCone,
        makeTranslatedBox(0.32, 2.0, 0.32, wtX - 1.0, h + 1.0, wtZ - 1.0),
        makeTranslatedBox(0.32, 2.0, 0.32, wtX + 1.0, h + 1.0, wtZ + 1.0)
      );

      if (h >= 72 || opts.spire) {
        const spireH = opts.spireHeight || 18;
        const spireBase = new THREE.ConeGeometry(Math.min(2.4, cw * 0.18), spireH * 0.38, 4);
        spireBase.rotateY(Math.PI / 4);
        spireBase.translate(0, h + spireH * 0.19, 0);
        const spireMast = new THREE.CylinderGeometry(0.14, 0.42, spireH, 6);
        spireMast.translate(0, h + spireH * 0.5, 0);
        trimGeos.push(spireBase, spireMast);
      }
    }
  }

  const mergedTrimGeo = mergeBufferGeometries(trimGeos);
  for (let i = 0; i < trimGeos.length; i++) trimGeos[i].dispose();
  const trimMat = getFastStandardMaterial(style.pillarHex, 0.28, 0.18);
  const trimMesh = new THREE.Mesh(mergedTrimGeo, trimMat);
  trimMesh.castShadow = false;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  // 3. Térreo Vivo na Altura da Rua (Base + Marquises mescladas em 1 único Mesh!)
  if ((opts.yBase === undefined || yBase < 1.5) && opts.groundFloor !== false) {
    const baseH = Math.min(6.8, h * 0.35);
    const vitW = Math.max(4, w * 0.58);
    const groundGeos = [
      makeTranslatedBox(w + 0.5, baseH, d + 0.5, 0, baseH * 0.5, 0),
      makeTranslatedBox(vitW + 2.0, 0.55, 1.9, 0, 5.1, -(d * 0.5 + 1.05)),
      makeTranslatedBox(vitW + 2.0, 0.55, 1.9, 0, 5.1, d * 0.5 + 1.05),
      makeTranslatedBox(vitW, 3.4, 0.4, 0, 2.5, -(d * 0.5 + 0.52)),
      makeTranslatedBox(vitW, 3.4, 0.4, 0, 2.5, d * 0.5 + 0.52)
    ];
    const mergedGroundGeo = mergeBufferGeometries(groundGeos);
    for (let i = 0; i < groundGeos.length; i++) groundGeos[i].dispose();
    const groundMesh = new THREE.Mesh(
      mergedGroundGeo,
      getFastStandardMaterial(style.baseHex, 0.32, 0.1)
    );
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;
    group.add(groundMesh);
  }

  world.scene.add(group);

  if (opts.collide !== false) {
    world.addCollider(x, z, w, d, yBase + h, Math.max(0, yBase - skirtDepth));
  }

  if (opts.registerMap !== false) {
    world.mapBuildings.push({
      x,
      z,
      w,
      d,
      height: h,
      styleKey,
      color: opts.mapColor || style.mapColor,
      label: opts.label || null
    });
  }

  return group;
}
