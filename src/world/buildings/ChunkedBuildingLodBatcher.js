import * as THREE from 'three';
import {
  makeFastBox,
  mergeBufferGeometries,
  mergeColoredGeometries,
  getSharedVertexColorMaterial,
  markAsSharedAsset
} from './VertexColorBufferMerge.js';

export const BUILDING_LOD_CHUNK_SIZE = 420;
export const BUILDING_LOD1_DISTANCE = 470;
export const BUILDING_LOD2_DISTANCE = 1380;

const NEON_MAT_CACHE = new Map();

function getSharedNeonMat(colorHex) {
  let mat = NEON_MAT_CACHE.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color: colorHex });
    markAsSharedAsset(mat);
    NEON_MAT_CACHE.set(colorHex, mat);
  }
  return mat;
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
 * Agrupador espacial 3-Níveis `THREE.LOD` para centenas de arranha-céus e prédios urbanos a 60 FPS:
 *  - Nível 0 (0..470m): Detalhe Art-Deco/Brutalista completo (fachada texturizada, cornijas, pilares, térreo, telões)
 *  - Nível 1 (470..1380m): Prismas simplificados com textura de janelas acesas (reduz ~88% dos triângulos distantes)
 *  - Nível 2 (>1380m): Silhueta sólida unificada em 1 único Draw Call por chunk de 420m!
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
        l0TrimEntries: [],
        l0GroundEntries: [],
        l0NeonByHex: new Map(),
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
      style,
      facadeMat,
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

    // 1. Nível 0 — Geometrias completas transformadas para o espaço local do chunk
    if (bodyGeo && facadeMat) {
      if (Math.abs(rotY) > 1e-4) bodyGeo.rotateY(rotY);
      bodyGeo.translate(lx, yBase, lz);
      let list0 = chunk.l0FacadeByMat.get(facadeMat);
      if (!list0) {
        list0 = [];
        chunk.l0FacadeByMat.set(facadeMat, list0);
      }
      list0.push(bodyGeo);
    }

    if (trimGeo) {
      if (Math.abs(rotY) > 1e-4) trimGeo.rotateY(rotY);
      trimGeo.translate(lx, yBase, lz);
      chunk.l0TrimEntries.push({
        geo: trimGeo,
        color: new THREE.Color(style.pillarHex)
      });
    }

    if (groundGeo) {
      if (Math.abs(rotY) > 1e-4) groundGeo.rotateY(rotY);
      groundGeo.translate(lx, yBase, lz);
      chunk.l0GroundEntries.push({
        geo: groundGeo,
        color: new THREE.Color(style.baseHex)
      });
    }

    // 2. Nível 1 — Prisma médio texturizado (1 ou 2 caixas limpas sem cornijas/térreo/HVAC)
    if (facadeMat) {
      let list1 = chunk.l1FacadeByMat.get(facadeMat);
      if (!list1) {
        list1 = [];
        chunk.l1FacadeByMat.set(facadeMat, list1);
      }
      if (lod1CustomGeo) {
        if (Math.abs(rotY) > 1e-4) lod1CustomGeo.rotateY(rotY);
        lod1CustomGeo.translate(lx, yBase, lz);
        list1.push(lod1CustomGeo);
      } else if (useArtDecoSetbacks && tier1H > 4 && h - tier1H > 2.5) {
        const upperH = h - tier1H;
        const midCrownW = (w * 0.82 + topCrownW) * 0.5;
        const midCrownD = (d * 0.82 + topCrownD) * 0.5;
        list1.push(
          makeLocalRotatedBox(w, tier1H, d, lx, yBase + tier1H * 0.5, lz, rotY),
          makeLocalRotatedBox(midCrownW, upperH, midCrownD, lx, yBase + tier1H + upperH * 0.5, lz, rotY)
        );
      } else {
        list1.push(makeLocalRotatedBox(w, h, d, lx, yBase + h * 0.5, lz, rotY));
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
      color: new THREE.Color(style.wallHex)
    });

    chunk.count++;
    this.totalBatchedBuildings++;
  }

  addNeonScreen(w, h, d, wx, wy, wz, rotY = 0, colorHex = 0x00f0ff) {
    const chunk = this._getChunk(wx, wz);
    const lx = wx - chunk.originX;
    const lz = wz - chunk.originZ;
    let list = chunk.l0NeonByHex.get(colorHex);
    if (!list) {
      list = [];
      chunk.l0NeonByHex.set(colorHex, list);
    }
    list.push(makeLocalRotatedBox(w, h, d, lx, wy, lz, rotY));
  }

  flushToScene(scene) {
    if (!scene || this.chunks.size === 0) return 0;

    const trimVcMat = getSharedVertexColorMaterial({
      roughness: 0.34,
      metalness: 0.16,
      clearcoat: 0.06,
      clearcoatRoughness: 0.45
    });
    const groundVcMat = getSharedVertexColorMaterial({
      roughness: 0.38,
      metalness: 0.1,
      clearcoat: 0.04,
      clearcoatRoughness: 0.5
    });
    const farVcMat = getSharedVertexColorMaterial({
      roughness: 0.58,
      metalness: 0.14,
      clearcoat: 0.02,
      clearcoatRoughness: 0.6
    });

    let createdChunks = 0;

    for (const chunk of this.chunks.values()) {
      if (chunk.count === 0 && chunk.l0NeonByHex.size === 0) continue;

      const lod = new THREE.LOD();
      lod.name = `BuildingChunkLOD_${chunk.key}`;
      lod.position.set(chunk.originX, 0, chunk.originZ);
      lod.userData = { isBuildingChunkLod: true, chunkKey: chunk.key, buildingCount: chunk.count };

      // Nível 0 (Detalhe Completo)
      const level0 = new THREE.Group();
      for (const [facadeMat, geos] of chunk.l0FacadeByMat.entries()) {
        if (!geos.length) continue;
        const merged = mergeBufferGeometries(geos);
        for (let i = 0; i < geos.length; i++) geos[i].dispose?.();
        const m = new THREE.Mesh(merged, facadeMat);
        m.castShadow = true;
        m.receiveShadow = true;
        level0.add(m);
      }

      if (chunk.l0TrimEntries.length > 0) {
        const mergedTrim = mergeColoredGeometries(chunk.l0TrimEntries);
        for (let i = 0; i < chunk.l0TrimEntries.length; i++) chunk.l0TrimEntries[i].geo.dispose?.();
        const tm = new THREE.Mesh(mergedTrim, trimVcMat);
        tm.castShadow = false;
        tm.receiveShadow = true;
        level0.add(tm);
      }

      if (chunk.l0GroundEntries.length > 0) {
        const mergedGround = mergeColoredGeometries(chunk.l0GroundEntries);
        for (let i = 0; i < chunk.l0GroundEntries.length; i++) chunk.l0GroundEntries[i].geo.dispose?.();
        const gm = new THREE.Mesh(mergedGround, groundVcMat);
        gm.castShadow = false;
        gm.receiveShadow = true;
        level0.add(gm);
      }

      for (const [hex, geos] of chunk.l0NeonByHex.entries()) {
        if (!geos.length) continue;
        const mergedNeon = mergeBufferGeometries(geos);
        for (let i = 0; i < geos.length; i++) geos[i].dispose?.();
        const nm = new THREE.Mesh(mergedNeon, getSharedNeonMat(hex));
        nm.castShadow = false;
        nm.receiveShadow = false;
        level0.add(nm);
      }

      // Nível 1 (Média Distância)
      const level1 = new THREE.Group();
      for (const [facadeMat, geos] of chunk.l1FacadeByMat.entries()) {
        if (!geos.length) continue;
        const merged1 = mergeBufferGeometries(geos);
        for (let i = 0; i < geos.length; i++) geos[i].dispose?.();
        const m1 = new THREE.Mesh(merged1, facadeMat);
        m1.castShadow = false;
        m1.receiveShadow = true;
        level1.add(m1);
      }

      // Nível 2 (Silhueta Distante)
      const level2 = new THREE.Group();
      if (chunk.l2SilhouetteEntries.length > 0) {
        const merged2 = mergeColoredGeometries(chunk.l2SilhouetteEntries);
        for (let i = 0; i < chunk.l2SilhouetteEntries.length; i++) chunk.l2SilhouetteEntries[i].geo.dispose?.();
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
