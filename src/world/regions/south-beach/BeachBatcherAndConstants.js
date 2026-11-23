import * as THREE from 'three';
import { makeFastBox, mergeColoredGeometries } from '../../BuildingGenerator.js';
import { markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ROAD, WORLD_SCALE, ws } from '../../core/WorldLayoutScale.js';

export const TROPICAL_WALL_KEYS = [
  { key: 'coastal_white', hex: 0xf8fafc, mapColor: '#f8fafc' },
  { key: 'coastal_turquoise', hex: 0x06b6d4, mapColor: '#06b6d4' },
  { key: 'coastal_aqua', hex: 0x2dd4bf, mapColor: '#2dd4bf' },
  { key: 'coastal_coral', hex: 0xfb7185, mapColor: '#fb7185' },
  { key: 'coastal_sun', hex: 0xfde047, mapColor: '#fde047' },
  { key: 'coastal_azure', hex: 0x38bdf8, mapColor: '#38bdf8' },
  { key: 'coastal_gold', hex: 0xf59e0b, mapColor: '#f59e0b' }
];

export const UMBRELLA_KEYS = [
  'umb_red',
  'umb_blue',
  'umb_orange',
  'umb_turquoise',
  'umb_pink',
  'umb_green',
  'umb_yellow'
];

// Os 3 Canais estilo Santos que descem da Avenida Beira-Mar e cortam a areia até o mar (largura 1x!)
export const DESIGN_SANTOS_CANALS_X = [-384, -120, 252];
export const SANTOS_CANALS_X = DESIGN_SANTOS_CANALS_X.map(ws);
export const CANAL_WIDTH = 22;

export const SOUTH_BEACH_LOD_CHUNK_SIZE = 1320;
export const SOUTH_BEACH_LOD1_DISTANCE = 280;

export function isInsideSantosCanal(x, margin = 14) {
  for (const cx of SANTOS_CANALS_X) {
    if (Math.abs(x - cx) < CANAL_WIDTH * 0.5 + margin) return true;
  }
  return false;
}

/**
 * Curva suave e determinística da Baía da Orla Sul (`x` de `ws(-1825)` a `ws(538)`):
 * - Zerada (`0m`) com derivada nula na raiz do Mega Píer (`x = 0`), nas bocas dos
 *   3 Canais de Santos (`SANTOS_CANALS_X`) e na entrada da Marina Oeste (`ws(-1380)`).
 * - Côncava até `-14m` nas enseadas entre canais e avançando até `+22m` rumo aos
 *   promontórios oeste/leste, mantendo `bwZStart >= ws(710) + ROAD.mainWidth * 0.5 + 2`.
 */
export function getSouthBeachBayOffsetZ(x) {
  const ux = THREE.MathUtils.clamp(IS_SCALED_WORLD ? x / WORLD_SCALE : x, -1825, 538);
  const sinSq = (u) => {
    const s = Math.sin(Math.PI * THREE.MathUtils.clamp(u, 0, 1));
    return s * s;
  };
  const hCos = (u) => 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(u, 0, 1));

  let raw = 0;
  if (ux <= -1380) {
    raw = 22.0 * hCos((-1380 - ux) / 445.0);
  } else if (ux <= -960) {
    raw = 13.5 * sinSq((ux + 1380) / 420.0);
  } else if (ux <= -384) {
    raw = -14.0 * sinSq((ux + 960) / 576.0);
  } else if (ux <= -120) {
    raw = -14.0 * sinSq((ux + 384) / 264.0);
  } else if (ux <= 0) {
    raw = -9.5 * sinSq((ux + 120) / 120.0);
  } else if (ux <= 252) {
    raw = -11.5 * sinSq(ux / 252.0);
  } else {
    raw = 20.0 * hCos((ux - 252) / 286.0);
  }

  if (!IS_SCALED_WORLD) {
    return Math.max(0, raw * 0.45);
  }
  const minAllowed = ws(710) + ROAD.mainWidth * 0.5 + 2 - ws(726);
  return Math.max(minAllowed, raw);
}

export function getSouthBeachBoardwalkBoundsZ(x) {
  const zOff = getSouthBeachBayOffsetZ(x);
  const bwZStart = ws(726) + zOff;
  const bwZEnd = ws(778) + zOff;
  const bwDepth = bwZEnd - bwZStart;
  const bwCenterZ = (bwZStart + bwZEnd) * 0.5;
  const bikeZ = IS_SCALED_WORLD ? bwZStart + 6.5 : bwZStart + 5.0;
  return { zOff, bwZStart, bwZEnd, bwDepth, bwCenterZ, bikeZ };
}

export function getSouthBeachShorelineZ(x) {
  return ws(1036) + getSouthBeachBayOffsetZ(x);
}

let _SHARED_SB_STD_VC_MAT = null;
let _SHARED_SB_BASIC_VC_MAT = null;

export function getSouthBeachStandardVcMat() {
  if (!_SHARED_SB_STD_VC_MAT) {
    _SHARED_SB_STD_VC_MAT = markAsSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.08
      })
    );
  }
  return _SHARED_SB_STD_VC_MAT;
}

export function getSouthBeachBasicVcMat() {
  if (!_SHARED_SB_BASIC_VC_MAT) {
    _SHARED_SB_BASIC_VC_MAT = markAsSharedAsset(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2
      })
    );
  }
  return _SHARED_SB_BASIC_VC_MAT;
}

const _TEMPLATE_BOX = new THREE.BoxGeometry(1, 1, 1);
const _T_POS = _TEMPLATE_BOX.attributes.position.array;
const _T_NORM = _TEMPLATE_BOX.attributes.normal.array;
const _T_UV = _TEMPLATE_BOX.attributes.uv.array;
const _T_IDX = _TEMPLATE_BOX.index.array;
_TEMPLATE_BOX.dispose();

/**
 * Cria um prisma hexaédrico contínuo cisalhado em Z entre `x0` e `x1`,
 * conectando `[z0Min..z0Max]` a `[z1Min..z1Max]` sem degraus nem Z-fighting.
 */
export function makeShearedZBoxGeo(x0, x1, h, yCenter, z0Min, z0Max, z1Min, z1Max) {
  const pos = new Float32Array(72);
  const norm = new Float32Array(_T_NORM);
  const uv = new Float32Array(_T_UV);
  const dx = Math.max(1e-4, x1 - x0);
  const dzMax = z1Max - z0Max;
  const dzMin = z1Min - z0Min;
  const lenMax = Math.hypot(dx, dzMax) || 1;
  const lenMin = Math.hypot(dx, dzMin) || 1;

  for (let i = 0; i < 72; i += 3) {
    const ux = _T_POS[i];
    const uy = _T_POS[i + 1];
    const uz = _T_POS[i + 2];
    pos[i] = ux < 0 ? x0 : x1;
    pos[i + 1] = yCenter + uy * h;
    pos[i + 2] = ux < 0 ? (uz < 0 ? z0Min : z0Max) : (uz < 0 ? z1Min : z1Max);
  }
  for (let i = 48; i < 60; i += 3) {
    norm[i] = -dzMax / lenMax;
    norm[i + 1] = 0;
    norm[i + 2] = dx / lenMax;
  }
  for (let i = 60; i < 72; i += 3) {
    norm[i] = dzMin / lenMin;
    norm[i + 1] = 0;
    norm[i + 2] = -dx / lenMin;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(_T_IDX), 1));
  return geo;
}

function _buildPaletteMap() {
  const map = new Map();
  const reg = (key, hex, basic = false) => {
    map.set(key, { color: new THREE.Color(hex), basic });
  };
  for (const t of TROPICAL_WALL_KEYS) reg(t.key, t.hex, false);
  reg('trim_white', 0xffffff);
  reg('stone_black', 0x18181b);
  reg('stone_grey', 0x64748b);
  reg('stone_white', 0xf1f5f9);
  reg('boardwalk_cream', 0xf1f5f9);
  reg('bike_red', 0xb91c1c);
  reg('glass_cyan', 0x38bdf8);
  reg('glass_sapphire', 0x1d4ed8);
  reg('window_warm', 0xfef08a, true);
  reg('neon_pink', 0xf43f5e, true);
  reg('neon_cyan', 0x00f0ff, true);
  reg('neon_gold', 0xfacc15, true);
  reg('pool_water', 0x06b6d4);
  reg('canal_water', 0x0284c7);
  reg('palm_trunk', 0x78350f);
  reg('palm_leaf', 0x16a34a);
  reg('coconut_brown', 0x451a03);
  reg('wood_pier', 0x7c2d12);
  reg('wood_pilings', 0x451a03);
  reg('wood_deck', 0xb45309);
  reg('pier_deck_brown', 0x6b3a1e);
  reg('pier_plaza_brown', 0x562c14);
  reg('sand_dry', 0xb89f72);
  reg('sand_wet', 0x7d6a49);
  reg('surf_foam', 0xf8fafc, true);
  reg('umb_red', 0xef4444);
  reg('umb_blue', 0x2563eb);
  reg('umb_orange', 0xf97316);
  reg('umb_turquoise', 0x06b6d4);
  reg('umb_pink', 0xec4899);
  reg('umb_green', 0x22c55e);
  reg('umb_yellow', 0xfacc15);
  return map;
}

const _SB_PALETTE = _buildPaletteMap();

/**
 * Batcher espacial da Orla Sul consolidando todas as peças em apenas 2 materiais
 * Vertex-Color compartilhados (`MeshStandardMaterial` + `MeshBasicMaterial`) e
 * fazendo flush em chunks `THREE.LOD` de 2 níveis (`L0 = 0m`, `L1 = 280m`).
 */
export class SouthBeachBatcher {
  constructor(chunkSize = SOUTH_BEACH_LOD_CHUNK_SIZE) {
    this.chunkSize = chunkSize;
    this.chunks = new Map();
  }

  _getChunk(wx, wz) {
    const gx = Math.floor(wx / this.chunkSize);
    const gz = Math.floor(wz / this.chunkSize);
    const cKey = `${gx},${gz}`;
    let ch = this.chunks.get(cKey);
    if (!ch) {
      ch = {
        originX: (gx + 0.5) * this.chunkSize,
        originZ: (gz + 0.5) * this.chunkSize,
        l0Std: [],
        l0Basic: [],
        l1Std: [],
        l1Basic: []
      };
      this.chunks.set(cKey, ch);
    }
    return ch;
  }

  addBox(key, w, h, d, x, y, z, isMicroDetail = undefined) {
    const style = _SB_PALETTE.get(key);
    if (!style) return;
    const ch = this._getChunk(x, z);
    const entry = {
      geo: makeFastBox(w, h, d, x - ch.originX, y, z - ch.originZ),
      color: style.color
    };
    if (isMicroDetail === 'l1_only') {
      (style.basic ? ch.l1Basic : ch.l1Std).push(entry);
      return;
    }
    const micro = typeof isMicroDetail === 'boolean'
      ? isMicroDetail
      : (Math.max(w, h, d) < 5.2 || (style.basic && Math.max(w, d) < 18.0));
    (style.basic ? ch.l0Basic : ch.l0Std).push(entry);
    if (!micro) {
      (style.basic ? ch.l1Basic : ch.l1Std).push(entry);
    }
  }

  addShearedBox(key, x0, x1, h, yCenter, z0Min, z0Max, z1Min, z1Max, isMicroDetail = false) {
    if (x1 - x0 <= 0.02) return;
    const cx = (x0 + x1) * 0.5;
    const cz = (z0Min + z0Max + z1Min + z1Max) * 0.25;
    const geo = makeShearedZBoxGeo(x0, x1, h, yCenter, z0Min, z0Max, z1Min, z1Max);
    this.addGeometry(key, geo, cx, cz, isMicroDetail);
  }

  addGeometry(key, worldGeo, refX, refZ, isMicroDetail = false) {
    const style = _SB_PALETTE.get(key);
    if (!style || !worldGeo) return;
    const ch = this._getChunk(refX, refZ);
    worldGeo.translate(-ch.originX, 0, -ch.originZ);
    if (isMicroDetail === 'l1_only') {
      (style.basic ? ch.l1Basic : ch.l1Std).push({ geo: worldGeo, color: style.color });
      return;
    }
    (style.basic ? ch.l0Basic : ch.l0Std).push({ geo: worldGeo, color: style.color });
    if (!isMicroDetail) {
      (style.basic ? ch.l1Basic : ch.l1Std).push({ geo: worldGeo.clone(), color: style.color });
    }
  }

  flush(scene) {
    const stdMat = getSouthBeachStandardVcMat();
    const basicMat = getSouthBeachBasicVcMat();
    const lods = [];

    const buildLevel = (stdList, basicList, isL0) => {
      const grp = new THREE.Group();
      if (stdList.length > 0) {
        const geo = mergeColoredGeometries(stdList);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, stdMat);
        mesh.castShadow = isL0;
        mesh.receiveShadow = true;
        grp.add(mesh);
      }
      if (basicList.length > 0) {
        const geo = mergeColoredGeometries(basicList);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, basicMat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        grp.add(mesh);
      }
      return grp;
    };

    for (const ch of this.chunks.values()) {
      if (!ch.l0Std.length && !ch.l0Basic.length && !ch.l1Std.length && !ch.l1Basic.length) continue;
      const lod = new THREE.LOD();
      lod.position.set(ch.originX, 0, ch.originZ);
      lod.userData.skipStaticMerge = true;
      lod.userData.isSouthBeachBatchLOD = true;
      lod.addLevel(buildLevel(ch.l0Std, ch.l0Basic, true), 0);
      lod.addLevel(buildLevel(ch.l1Std, ch.l1Basic, false), SOUTH_BEACH_LOD1_DISTANCE);
      scene.add(lod);
      lods.push(lod);
    }

    this.chunks.clear();
    return lods;
  }
}

export function addCurvedLegoPalmTree(batcher, x, yBase, z, leanDirX = 0.25, leanDirZ = 0.85, scale = 1.0) {
  const segments = 5;
  const segH = 1.38 * scale;
  let curX = x;
  let curY = yBase;
  let curZ = z;

  for (let s = 0; s < segments; s++) {
    const t = s / segments;
    const w = (0.72 - t * 0.24) * scale;
    curX += leanDirX * (0.22 + t * 0.38) * scale;
    curZ += leanDirZ * (0.22 + t * 0.38) * scale;
    batcher.addBox('palm_trunk', w, segH, w, curX, curY + segH * 0.5, curZ, true);
    curY += segH * 0.92;
  }

  // Proxy enxuto para L1 (>= 280m): 1 tronco + 1 copa verde sem cocos/folhas individuais!
  const totalTrunkH = curY - yBase;
  batcher.addBox('palm_trunk', 0.58 * scale, totalTrunkH, 0.58 * scale, (x + curX) * 0.5, yBase + totalTrunkH * 0.5, (z + curZ) * 0.5, 'l1_only');
  batcher.addBox('palm_leaf', 4.6 * scale, 1.05 * scale, 4.6 * scale, curX, curY + 0.12 * scale, curZ, 'l1_only');

  batcher.addBox('coconut_brown', 0.42 * scale, 0.42 * scale, 0.42 * scale, curX + 0.28, curY - 0.15, curZ + 0.22, true);
  batcher.addBox('coconut_brown', 0.42 * scale, 0.42 * scale, 0.42 * scale, curX - 0.26, curY - 0.15, curZ + 0.24, true);

  const frondDirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]
  ];
  for (const [dx, dz] of frondDirs) {
    const f1X = curX + dx * 1.45 * scale;
    const f1Z = curZ + dz * 1.45 * scale;
    const w1 = Math.abs(dx) > 0.5 ? 2.4 * scale : 0.95 * scale;
    const d1 = Math.abs(dz) > 0.5 ? 2.4 * scale : 0.95 * scale;
    batcher.addBox('palm_leaf', w1, 0.32 * scale, d1, f1X, curY + 0.28 * scale, f1Z, true);

    const f2X = curX + dx * 2.85 * scale;
    const f2Z = curZ + dz * 2.85 * scale;
    const w2 = Math.abs(dx) > 0.5 ? 1.65 * scale : 0.78 * scale;
    const d2 = Math.abs(dz) > 0.5 ? 1.65 * scale : 0.78 * scale;
    batcher.addBox('palm_leaf', w2, 0.28 * scale, d2, f2X, curY - 0.22 * scale, f2Z, true);
  }
}

export function addNeonHotelSign(world, x, y, z, width, text, borderColor = '#00f0ff', textColor = '#facc15') {
  const signBoard = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height: 4.8,
    depth: 0.9,
    title: text,
    bgColor: '#090a0d',
    borderColor,
    textColor,
    doubleSided: true
  });
  world.scene.add(signBoard);
}
