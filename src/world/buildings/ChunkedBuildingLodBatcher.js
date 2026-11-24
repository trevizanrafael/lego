import * as THREE from 'three';
import {
  makeFastBox,
  mergeColoredGeometries,
  markAsSharedAsset
} from './VertexColorBufferMerge.js';
import {
  getFamilyFacadeMaterialForStyle,
  getStyleVertexTintColor
} from './BuildingFamiliesAndAtlas.js';
import { NearestBoxLOD } from '../core/NearestBoxLOD.js';

export const BUILDING_LOD_CHUNK_SIZE = 740;
export const BUILDING_LOD1_DISTANCE = 185;
export const BUILDING_LOD2_DISTANCE = 900;
/** Famílias de fachada com material próprio no L1 (o resto entra na dominante). */
export const L1_MAX_FACADE_FAMILIES = 3;

const _COLOR_CACHE = new Map();
let _sharedTrimAndGroundVcMat = null;
let _sharedFarSilhouetteVcMat = null;
let _sharedNeonVcMat = null;

function getCachedHexColor(hex) {
  let col = _COLOR_CACHE.get(hex);
  if (!col) {
    col = new THREE.Color(hex);
    _COLOR_CACHE.set(hex, col);
  }
  return col;
}

function getSharedTrimAndGroundMaterial() {
  if (!_sharedTrimAndGroundVcMat) {
    _sharedTrimAndGroundVcMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.12
    });
    markAsSharedAsset(_sharedTrimAndGroundVcMat);
  }
  return _sharedTrimAndGroundVcMat;
}

function getSharedFarSilhouetteMaterial() {
  if (!_sharedFarSilhouetteVcMat) {
    _sharedFarSilhouetteVcMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.12
    });
    markAsSharedAsset(_sharedFarSilhouetteVcMat);
  }
  return _sharedFarSilhouetteVcMat;
}

function getSharedNeonVertexColorMaterial() {
  if (!_sharedNeonVcMat) {
    _sharedNeonVcMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true
    });
    markAsSharedAsset(_sharedNeonVcMat);
  }
  return _sharedNeonVcMat;
}

function makeLocalRotatedBox(w, h, d, lx, ly, lz, rotY = 0) {
  if (Math.abs(rotY) <= 1e-4) {
    return makeFastBox(w, h, d, lx, ly, lz);
  }
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(rotY);
  g.translate(lx, ly, lz);
  return g;
}

const _OPEN_BOTTOM_IDX = [
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19
];

/**
 * Caixa 5 faces (sem tampa inferior enterrada = 10 triângulos em vez de 12, UVs de fachada preservados).
 */
function makeOpenBottomLodBox(w, h, d, lx, ly, lz, rotY = 0, withUv = true) {
  const hx = w * 0.5, hy = h * 0.5, hz = d * 0.5;
  const cosY = Math.abs(rotY) > 1e-4 ? Math.cos(rotY) : 1;
  const sinY = Math.abs(rotY) > 1e-4 ? Math.sin(rotY) : 0;
  const rawPos = [
    // +Z (frente)
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    // -Z (fundo)
    hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz,
    // +X (direita)
    hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz,
    // -X (esquerda)
    -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz,
    // +Y (teto)
    -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz
  ];
  const rawNorm = [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0
  ];
  const pos = new Float32Array(60);
  const norm = new Float32Array(60);
  for (let i = 0; i < 20; i++) {
    const px = rawPos[i * 3], py = rawPos[i * 3 + 1], pz = rawPos[i * 3 + 2];
    pos[i * 3] = px * cosY + pz * sinY + lx;
    pos[i * 3 + 1] = py + ly;
    pos[i * 3 + 2] = -px * sinY + pz * cosY + lz;
    const nx = rawNorm[i * 3], ny = rawNorm[i * 3 + 1], nz = rawNorm[i * 3 + 2];
    norm[i * 3] = nx * cosY + nz * sinY;
    norm[i * 3 + 1] = ny;
    norm[i * 3 + 2] = -nx * sinY + nz * cosY;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  if (withUv) {
    const uX = Math.max(1, Math.round(w / 24)), uZ = Math.max(1, Math.round(d / 24)), uY = Math.max(1, Math.round(h / 36));
    const uvs = new Float32Array([
      0, 0, uX, 0, uX, uY, 0, uY,
      0, 0, uX, 0, uX, uY, 0, uY,
      0, 0, uZ, 0, uZ, uY, 0, uY,
      0, 0, uZ, 0, uZ, uY, 0, uY,
      0, 0, 0.05, 0, 0.05, 0.05, 0, 0.05
    ]);
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  g.setIndex(_OPEN_BOTTOM_IDX);
  return g;
}

/**
 * Agrupador espacial 3-Níveis `THREE.LOD` com Famílias Unificadas de Fachada + Vertex Colors (M2/M5):
 *  - Nível 0 (0..220m): Até 4 meshes de fachada por família + 1 `l0TrimAndGround` + 1 `l0Neon`
 *  - Nível 1 (220..640m): Até 4 prismas de família com textura de janelas acesas + vertex color
 *  - Nível 2 (>640m): Silhueta sólida unificada em 1 único Draw Call `MeshStandardMaterial` por chunk de 620m
 */
export class ChunkedBuildingLodBatcher {
  constructor(chunkSize = BUILDING_LOD_CHUNK_SIZE) {
    this.chunkSize = chunkSize;
    this.chunks = new Map();
    this.totalBatchedBuildings = 0;
  }

  _getChunk(wx, wz) {
    const maxAbs = Math.max(Math.abs(wx), Math.abs(wz));
    const cs = maxAbs > 2200 ? this.chunkSize * 4 : maxAbs > 1080 ? Math.round(this.chunkSize * 2.2) : this.chunkSize;
    const gx = Math.floor(wx / cs);
    const gz = Math.floor(wz / cs);
    const key = `${cs}:${gx},${gz}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = {
        key,
        gx,
        gz,
        originX: (gx + 0.5) * cs,
        originZ: (gz + 0.5) * cs,
        l0FacadeByMat: new Map(),
        l0TrimAndGroundEntries: [],
        l0NeonEntries: [],
        l1FacadeByMat: new Map(),
        l2SilhouetteEntries: [],
        count: 0
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  addDetailedBuildingEntry(entry) {
    const {
      cx,
      cz,
      yBase,
      rotY = 0,
      styleKey = 'sapphire_glass',
      style,
      bodyGeo,
      trimGeo,
      groundGeo,
      w,
      h,
      d,
      useArtDecoSetbacks,
      tier1H,
      topCrownW,
      topCrownD,
      lod1CustomGeo = null,
      lod2CustomGeo = null
    } = entry;

    const chunk = this._getChunk(cx, cz);
    const lx = cx - chunk.originX;
    const lz = cz - chunk.originZ;
    const seedVariant = entry.seed ?? Math.abs(Math.round(cx * 7 + cz * 13 + h * 3));
    const familyFacadeMat = getFamilyFacadeMaterialForStyle(styleKey, { useVertexColors: true });
    const facadeTintColor = getStyleVertexTintColor(styleKey, seedVariant);

    // 1. Nível 0 — Fachada na família compartilhada + acabamento/térreo unificados por Vertex Color
    if (bodyGeo && familyFacadeMat) {
      if (Math.abs(rotY) > 1e-4) bodyGeo.rotateY(rotY);
      bodyGeo.translate(lx, yBase, lz);
      let list0 = chunk.l0FacadeByMat.get(familyFacadeMat);
      if (!list0) {
        list0 = [];
        chunk.l0FacadeByMat.set(familyFacadeMat, list0);
      }
      list0.push({ geo: bodyGeo, color: facadeTintColor });
    }

    if (trimGeo) {
      if (Math.abs(rotY) > 1e-4) trimGeo.rotateY(rotY);
      trimGeo.translate(lx, yBase, lz);
      chunk.l0TrimAndGroundEntries.push({
        geo: trimGeo,
        color: getCachedHexColor(style?.pillarHex ?? 0x334155)
      });
    }

    if (groundGeo) {
      if (Math.abs(rotY) > 1e-4) groundGeo.rotateY(rotY);
      groundGeo.translate(lx, yBase, lz);
      chunk.l0TrimAndGroundEntries.push({
        geo: groundGeo,
        color: getCachedHexColor(style?.baseHex ?? 0x090d16)
      });
    }

    // 2. Nível 1 — Prisma médio texturizado na mesma família com Vertex Color
    if (familyFacadeMat) {
      let list1 = chunk.l1FacadeByMat.get(familyFacadeMat);
      if (!list1) {
        list1 = [];
        chunk.l1FacadeByMat.set(familyFacadeMat, list1);
      }
      if (lod1CustomGeo) {
        if (Math.abs(rotY) > 1e-4) lod1CustomGeo.rotateY(rotY);
        lod1CustomGeo.translate(lx, yBase, lz);
        list1.push({ geo: lod1CustomGeo, color: facadeTintColor });
      } else if (useArtDecoSetbacks && tier1H > 4 && h - tier1H > 2.5) {
        const upperH = h - tier1H;
        const midCrownW = (w * 0.82 + topCrownW) * 0.5;
        const midCrownD = (d * 0.82 + topCrownD) * 0.5;
        list1.push(
          { geo: makeOpenBottomLodBox(w, tier1H, d, lx, yBase + tier1H * 0.5, lz, rotY, true), color: facadeTintColor },
          { geo: makeOpenBottomLodBox(midCrownW, upperH, midCrownD, lx, yBase + tier1H + upperH * 0.5, lz, rotY, true), color: facadeTintColor }
        );
      } else {
        list1.push({
          geo: makeOpenBottomLodBox(w, h, d, lx, yBase + h * 0.5, lz, rotY, true),
          color: facadeTintColor
        });
      }
    }

    // 3. Nível 2 — Silhueta distante ultra-enxuta (5 faces = 10 tris por prédio, castShadow = false)
    let silGeo = lod2CustomGeo;
    if (silGeo) {
      if (Math.abs(rotY) > 1e-4) silGeo.rotateY(rotY);
      silGeo.translate(lx, yBase, lz);
    } else {
      // Etapa 2.1: com UV, a silhueta usa a fachada (janelas acesas à noite) em vez de bloco liso.
      silGeo = makeOpenBottomLodBox(w * 0.96, h, d * 0.96, lx, yBase + h * 0.5, lz, rotY, true);
    }
    chunk.l2SilhouetteEntries.push({
      geo: silGeo,
      color: familyFacadeMat ? facadeTintColor : getCachedHexColor(style?.wallHex ?? 0x09192e),
      facadeMat: familyFacadeMat || null
    });

    chunk.count++;
    this.totalBatchedBuildings++;
  }

  addNeonScreen(w, h, d, wx, wy, wz, rotY = 0, colorHex = 0x00f0ff) {
    const chunk = this._getChunk(wx, wz);
    const lx = wx - chunk.originX;
    const lz = wz - chunk.originZ;
    chunk.l0NeonEntries.push({
      geo: makeLocalRotatedBox(w, h, d, lx, wy, lz, rotY),
      color: getCachedHexColor(colorHex)
    });
  }

  flushToScene(scene) {
    if (!scene || this.chunks.size === 0) return 0;

    const trimAndGroundVcMat = getSharedTrimAndGroundMaterial();
    const farVcMat = getSharedFarSilhouetteMaterial();
    const neonVcMat = getSharedNeonVertexColorMaterial();

    let createdChunks = 0;

    for (const chunk of this.chunks.values()) {
      if (chunk.count === 0 && chunk.l0NeonEntries.length === 0) continue;

      const lod = new NearestBoxLOD();
      lod.name = `BuildingChunkLOD_${chunk.key}`;
      lod.position.set(chunk.originX, 0, chunk.originZ);
      lod.userData = { isBuildingChunkLod: true, chunkKey: chunk.key, buildingCount: chunk.count };

      // Nível 0 (Detalhe Completo): cada família de fachada mantém o PRÓPRIO material.
      // Etapa 2.0: unificar famílias na dominante (otimização do M9) pintava prédios com
      // a textura errada/"sem textura" de perto. O L0 só existe nos chunks a <185 m,
      // então o custo extra de draw calls fica limitado aos poucos chunks vizinhos.
      const level0 = new THREE.Group();
      const sorted0 = [...chunk.l0FacadeByMat.entries()].filter(([, e]) => e.length > 0).sort((a, b) => b[1].length - a[1].length);
      if (sorted0.length > 0) {
        const primary = sorted0.map(([mat, entries]) => [mat, [...entries]]);
        for (const [facadeMat, entries] of primary) {
          const merged = mergeColoredGeometries(entries);
          merged.computeBoundingBox(); merged.computeBoundingSphere();
          const m = new THREE.Mesh(merged, facadeMat);
          m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
          m.userData.isChunkBuildingShadowCaster = true;
          level0.add(m);
        }
      }

      if (chunk.l0TrimAndGroundEntries.length > 0) {
        const mergedTrimAndGround = mergeColoredGeometries(chunk.l0TrimAndGroundEntries);
        mergedTrimAndGround.computeBoundingBox();
        mergedTrimAndGround.computeBoundingSphere();
        const tgm = new THREE.Mesh(mergedTrimAndGround, trimAndGroundVcMat);
        tgm.name = 'l0TrimAndGround';
        tgm.castShadow = false;
        tgm.receiveShadow = true;
        tgm.matrixAutoUpdate = false;
        tgm.updateMatrix();
        level0.add(tgm);
      }

      if (chunk.l0NeonEntries.length > 0) {
        const mergedNeon = mergeColoredGeometries(chunk.l0NeonEntries);
        mergedNeon.computeBoundingBox();
        mergedNeon.computeBoundingSphere();
        const nm = new THREE.Mesh(mergedNeon, neonVcMat);
        nm.name = 'l0Neon';
        nm.castShadow = false;
        nm.receiveShadow = false;
        nm.matrixAutoUpdate = false;
        nm.updateMatrix();
        level0.add(nm);
      }

      // Nível 1 (Média Distância): até 3 famílias de fachada com material próprio; as demais
      // entram na família mais parecida em quantidade (a dominante).
      const level1 = new THREE.Group();
      const sorted1 = [...chunk.l1FacadeByMat.entries()].filter(([, e]) => e.length > 0).sort((a, b) => b[1].length - a[1].length);
      if (sorted1.length > 0) {
        const keep1 = sorted1.slice(0, L1_MAX_FACADE_FAMILIES).map(([mat, entries]) => [mat, [...entries]]);
        for (let r = L1_MAX_FACADE_FAMILIES; r < sorted1.length; r++) keep1[0][1].push(...sorted1[r][1]);
        for (const [facadeMat, entries] of keep1) {
          const merged1 = mergeColoredGeometries(entries);
          merged1.computeBoundingBox();
          merged1.computeBoundingSphere();
          const m1 = new THREE.Mesh(merged1, facadeMat);
          m1.castShadow = false;
          m1.receiveShadow = false;
          m1.matrixAutoUpdate = false;
          m1.updateMatrix();
          level1.add(m1);
        }
      }

      // Nível 2 (Silhueta Distante): 1 draw call com a fachada dominante do chunk (janelas
      // acesas) quando todas as silhuetas têm UV; senão cai no material liso antigo.
      const level2 = new THREE.Group();
      if (chunk.l2SilhouetteEntries.length > 0) {
        const merged2 = mergeColoredGeometries(chunk.l2SilhouetteEntries);
        merged2.computeBoundingBox();
        merged2.computeBoundingSphere();
        const facadeCounts = new Map();
        for (const e of chunk.l2SilhouetteEntries) if (e.facadeMat) facadeCounts.set(e.facadeMat, (facadeCounts.get(e.facadeMat) || 0) + 1);
        const dominant2 = [...facadeCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const m2 = new THREE.Mesh(merged2, dominant2 && merged2.attributes.uv ? dominant2 : farVcMat);
        m2.castShadow = false;
        m2.receiveShadow = false;
        m2.matrixAutoUpdate = false;
        m2.updateMatrix();
        level2.add(m2);
      }

      lod.addLevel(level0, 0);
      // Etapa 2.0: qualquer chunk com fachada média ganha o L1 (antes, chunks com <9 prédios
      // pulavam direto para a silhueta escura a 185 m — a skyline ficava "apagada").
      if (level1.children.length > 0) {
        lod.addLevel(level1, BUILDING_LOD1_DISTANCE);
        lod.addLevel(level2, BUILDING_LOD2_DISTANCE);
        level1.visible = false;
      } else {
        lod.addLevel(level2, BUILDING_LOD1_DISTANCE);
      }
      level0.visible = true;
      level2.visible = false;

      scene.add(lod);
      createdChunks++;
    }

    this.chunks.clear();
    return createdChunks;
  }
}
