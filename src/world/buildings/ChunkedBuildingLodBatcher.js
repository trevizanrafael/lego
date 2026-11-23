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

export const BUILDING_LOD_CHUNK_SIZE = 320;
export const BUILDING_LOD1_DISTANCE = 300;
export const BUILDING_LOD2_DISTANCE = 1180;

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

/**
 * Agrupador espacial 3-Níveis `THREE.LOD` com Famílias Unificadas de Fachada + Vertex Colors (M2):
 *  - Nível 0 (0..300m): Até 4 meshes de fachada por família + 1 `l0TrimAndGround` + 1 `l0Neon`
 *  - Nível 1 (300..1180m): Até 4 prismas de família com textura de janelas acesas + vertex color
 *  - Nível 2 (>1180m): Silhueta sólida unificada em 1 único Draw Call `MeshStandardMaterial` por chunk de 320m
 */
export class ChunkedBuildingLodBatcher {
  constructor(chunkSize = BUILDING_LOD_CHUNK_SIZE) {
    this.chunkSize = chunkSize;
    this.chunks = new Map();
    this.totalBatchedBuildings = 0;
  }

  _getChunk(wx, wz) {
    const gx = Math.floor(wx / this.chunkSize);
    const gz = Math.floor(wz / this.chunkSize);
    const key = `${gx},${gz}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = {
        key,
        gx,
        gz,
        originX: (gx + 0.5) * this.chunkSize,
        originZ: (gz + 0.5) * this.chunkSize,
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
          { geo: makeLocalRotatedBox(w, tier1H, d, lx, yBase + tier1H * 0.5, lz, rotY), color: facadeTintColor },
          { geo: makeLocalRotatedBox(midCrownW, upperH, midCrownD, lx, yBase + tier1H + upperH * 0.5, lz, rotY), color: facadeTintColor }
        );
      } else {
        list1.push({
          geo: makeLocalRotatedBox(w, h, d, lx, yBase + h * 0.5, lz, rotY),
          color: facadeTintColor
        });
      }
    }

    // 3. Nível 2 — Silhueta distante em 1 única caixa sólida por prédio
    let silGeo = lod2CustomGeo;
    if (silGeo) {
      if (Math.abs(rotY) > 1e-4) silGeo.rotateY(rotY);
      silGeo.translate(lx, yBase, lz);
    } else {
      silGeo = makeLocalRotatedBox(w * 0.96, h, d * 0.96, lx, yBase + h * 0.5, lz, rotY);
    }
    chunk.l2SilhouetteEntries.push({
      geo: silGeo,
      color: getCachedHexColor(style?.wallHex ?? 0x09192e)
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

      const lod = new THREE.LOD();
      lod.name = `BuildingChunkLOD_${chunk.key}`;
      lod.position.set(chunk.originX, 0, chunk.originZ);
      lod.userData = { isBuildingChunkLod: true, chunkKey: chunk.key, buildingCount: chunk.count };

      // Nível 0 (Detalhe Completo)
      const level0 = new THREE.Group();
      for (const [facadeMat, entries] of chunk.l0FacadeByMat.entries()) {
        if (!entries.length) continue;
        const merged = mergeColoredGeometries(entries);
        const m = new THREE.Mesh(merged, facadeMat);
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.isChunkBuildingShadowCaster = true;
        level0.add(m);
      }

      if (chunk.l0TrimAndGroundEntries.length > 0) {
        const mergedTrimAndGround = mergeColoredGeometries(chunk.l0TrimAndGroundEntries);
        const tgm = new THREE.Mesh(mergedTrimAndGround, trimAndGroundVcMat);
        tgm.name = 'l0TrimAndGround';
        tgm.castShadow = false;
        tgm.receiveShadow = true;
        level0.add(tgm);
      }

      if (chunk.l0NeonEntries.length > 0) {
        const mergedNeon = mergeColoredGeometries(chunk.l0NeonEntries);
        const nm = new THREE.Mesh(mergedNeon, neonVcMat);
        nm.name = 'l0Neon';
        nm.castShadow = false;
        nm.receiveShadow = false;
        level0.add(nm);
      }

      // Nível 1 (Média Distância)
      const level1 = new THREE.Group();
      for (const [facadeMat, entries] of chunk.l1FacadeByMat.entries()) {
        if (!entries.length) continue;
        const merged1 = mergeColoredGeometries(entries);
        const m1 = new THREE.Mesh(merged1, facadeMat);
        m1.castShadow = false;
        m1.receiveShadow = true;
        level1.add(m1);
      }

      // Nível 2 (Silhueta Distante)
      const level2 = new THREE.Group();
      if (chunk.l2SilhouetteEntries.length > 0) {
        const merged2 = mergeColoredGeometries(chunk.l2SilhouetteEntries);
        const m2 = new THREE.Mesh(merged2, farVcMat);
        m2.castShadow = false;
        m2.receiveShadow = false;
        level2.add(m2);
      }

      lod.addLevel(level0, 0);
      lod.addLevel(level1, BUILDING_LOD1_DISTANCE);
      lod.addLevel(level2, BUILDING_LOD2_DISTANCE);
      level0.visible = true;
      level1.visible = false;
      level2.visible = false;

      scene.add(lod);
      createdChunks++;
    }

    this.chunks.clear();
    return createdChunks;
  }
}
