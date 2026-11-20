import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';

export { markAsSharedAsset };

// Geometria-base estática 1x1x1 para `makeTranslatedBox` ultrarrápido sem alocar BoxGeometry/Vector3/Matrix4 por bloco
const _UNIT_BOX_SRC = new THREE.BoxGeometry(1, 1, 1);
const _UNIT_BOX_POS = _UNIT_BOX_SRC.attributes.position.array;
const _UNIT_BOX_NORM = _UNIT_BOX_SRC.attributes.normal.array;
const _UNIT_BOX_UV = _UNIT_BOX_SRC.attributes.uv.array;
const _UNIT_BOX_IDX = _UNIT_BOX_SRC.index.array;
_UNIT_BOX_SRC.dispose();

export const DEFAULT_WHITE_COLOR = new THREE.Color(0xffffff);
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

/**
 * Helper ultrarrápido para criar uma BoxGeometry já escalada e transladada para (x, y, z) pronta para merge.
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
    const c = entry.color || DEFAULT_WHITE_COLOR;
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
