import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';

/**
 * 4 Famílias Arquitetônicas Compartilhadas (M2):
 * Substituem os antigos 24 `MeshPhysicalMaterial`s por 4 famílias `MeshStandardMaterial`
 * moduladas via `vertexColors` por prédio, preservando `emissiveMap` noturno nítido.
 */
export const BUILDING_FACADE_FAMILIES = Object.freeze({
  curtain_glass: Object.freeze({
    key: 'curtain_glass',
    roughness: 0.24,
    metalness: 0.36,
    bgColor: '#122636',
    spandrelColor: '#1d394f',
    mullionColor: '#738d9f',
    darkWinColor: '#06111b',
    litColors: ['#fde68a', '#f59e0b', '#bae6fd', '#a7f3d0'],
    brickMortar: false,
    seedSalt: 1
  }),
  obsidian_deco: Object.freeze({
    key: 'obsidian_deco',
    roughness: 0.28,
    metalness: 0.36,
    bgColor: '#2a3342',
    spandrelColor: '#1b222e',
    mullionColor: '#9ea39c',
    darkWinColor: '#070a11',
    litColors: ['#fbbf24', '#fde68a', '#e2e8f0', '#d97706'],
    brickMortar: false,
    seedSalt: 2
  }),
  brutalist_stone: Object.freeze({
    key: 'brutalist_stone',
    roughness: 0.58,
    metalness: 0.08,
    bgColor: '#5f646b',
    spandrelColor: '#42474e',
    mullionColor: '#8e9399',
    darkWinColor: '#101319',
    litColors: ['#fbbf24', '#f59e0b', '#fef3c7'],
    brickMortar: false,
    seedSalt: 3
  }),
  soot_brick: Object.freeze({
    key: 'soot_brick',
    roughness: 0.64,
    metalness: 0.06,
    bgColor: '#471c12',
    spandrelColor: '#2a100a',
    mullionColor: '#7c746e',
    darkWinColor: '#110d0c',
    litColors: ['#f59e0b', '#fbbf24', '#fed7aa'],
    brickMortar: true,
    seedSalt: 4
  })
});

export const STYLE_TO_FAMILY_MAP = Object.freeze({
  sapphire_glass: 'curtain_glass',
  cyan_modern: 'curtain_glass',
  emerald_steel: 'curtain_glass',
  black_granite_gold: 'obsidian_deco',
  silver_corporate: 'obsidian_deco',
  white_concrete: 'brutalist_stone',
  classic_sandstone: 'brutalist_stone',
  ny_brick: 'soot_brick'
});

// Tons moduladores sutis por estilo (mantêm janelas e caixilhos nítidos sob multiplicação por vértice)
const STYLE_BASE_TINTS = Object.freeze({
  sapphire_glass: [0.56, 0.74, 0.98],
  cyan_modern: [0.50, 0.90, 0.97],
  emerald_steel: [0.48, 0.90, 0.74],
  black_granite_gold: [0.54, 0.50, 0.44],
  silver_corporate: [0.88, 0.93, 1.00],
  white_concrete: [0.90, 0.94, 1.00],
  classic_sandstone: [0.98, 0.84, 0.69],
  ny_brick: [0.96, 0.88, 0.84]
});

const SEED_MODULATORS = Object.freeze([
  [1.00, 1.00, 1.00],
  [0.94, 0.95, 0.97],
  [1.04, 1.02, 0.98],
  [0.92, 0.94, 0.92],
  [1.02, 0.98, 1.03]
]);

const _FAMILY_TEXTURES_CACHE = new Map();
const _FAMILY_MATERIAL_CACHE = new Map();
const _STYLE_TINT_CACHE = new Map();

export function getFacadeFamilyKeyForStyle(styleKey) {
  return STYLE_TO_FAMILY_MAP[styleKey] || 'curtain_glass';
}

function configureFacadeCanvasTexture(canvas) {
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
  return tex;
}

function getOrBuildFamilyTexturePair(familyKey) {
  let pair = _FAMILY_TEXTURES_CACHE.get(familyKey);
  if (pair) return pair;

  const spec = BUILDING_FACADE_FAMILIES[familyKey] || BUILDING_FACADE_FAMILIES.curtain_glass;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = 256;
  emissiveCanvas.height = 512;
  const ectx = emissiveCanvas.getContext('2d');

  ctx.fillStyle = spec.bgColor;
  ctx.fillRect(0, 0, 256, 512);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 256, 512);

  if (spec.brickMortar) {
    ctx.fillStyle = 'rgba(20, 10, 8, 0.28)';
    for (let by = 0; by < 512; by += 8) {
      ctx.fillRect(0, by, 256, 1);
    }
  }

  const cols = 4;
  const rows = 8;
  const cellW = 256 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * cellH;
    ctx.fillStyle = spec.spandrelColor;
    ctx.fillRect(0, y, 256, 12);

    ctx.fillStyle = spec.mullionColor;
    ctx.globalAlpha = 0.74;
    ctx.fillRect(0, y + 9, 256, 3);
    ctx.globalAlpha = 1;

    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      ctx.fillStyle = spec.mullionColor;
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, y, 6, cellH);
      ctx.globalAlpha = 1;

      const hash = ((r * 19 + c * 37 + spec.seedSalt * 17) * 2654435761) >>> 0;
      const isLit = (hash % 10) < 4;
      const winX = x + 9;
      const winY = y + 16;
      const winW = cellW - 14;
      const winH = cellH - 22;

      if (isLit) {
        const litColor = spec.litColors[hash % spec.litColors.length];
        ctx.fillStyle = '#05070c';
        ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);
        ctx.fillStyle = litColor;
        ctx.fillRect(winX, winY, winW, winH);
        ctx.fillStyle = 'rgba(255, 251, 235, 0.72)';
        ctx.fillRect(winX + 2, winY + 2, winW - 4, 5);
        ctx.fillStyle = 'rgba(8, 10, 16, 0.36)';
        ctx.fillRect(winX, winY + (winH >> 1), winW, 2);

        ectx.fillStyle = litColor;
        ectx.fillRect(winX, winY, winW, winH);
        ectx.fillStyle = '#fffbeb';
        ectx.fillRect(winX + 2, winY + 2, winW - 4, 5);
      } else {
        ctx.fillStyle = '#04060a';
        ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);
        ctx.fillStyle = spec.darkWinColor;
        ctx.fillRect(winX, winY, winW, winH);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.10)';
        ctx.fillRect(winX + 3, winY + 3, 8, winH - 6);
      }
    }
  }

  if (typeof ctx.createLinearGradient === 'function') {
    const sootTop = ctx.createLinearGradient(0, 0, 0, 92);
    sootTop.addColorStop(0, 'rgba(4, 6, 10, 0.38)');
    sootTop.addColorStop(1, 'rgba(4, 6, 10, 0)');
    ctx.fillStyle = sootTop;
    ctx.fillRect(0, 0, 256, 92);

    const sootBot = ctx.createLinearGradient(0, 404, 0, 512);
    sootBot.addColorStop(0, 'rgba(4, 6, 10, 0)');
    sootBot.addColorStop(1, 'rgba(4, 6, 10, 0.42)');
    ctx.fillStyle = sootBot;
    ctx.fillRect(0, 404, 256, 108);
  }
  ctx.fillStyle = 'rgba(5, 7, 12, 0.14)';
  for (let sx = 12; sx < 256; sx += 29) {
    const streakLen = 68 + ((sx * 37 + spec.seedSalt * 23) % 184);
    ctx.fillRect(sx, 0, 2, streakLen);
  }

  pair = {
    map: configureFacadeCanvasTexture(canvas),
    emissiveMap: configureFacadeCanvasTexture(emissiveCanvas)
  };
  _FAMILY_TEXTURES_CACHE.set(familyKey, pair);
  return pair;
}

export function getFamilyFacadeMaterialForStyle(styleKey, opts = {}) {
  const useVertexColors = opts.useVertexColors !== false;
  const familyKey = getFacadeFamilyKeyForStyle(styleKey);
  const cacheKey = `${familyKey}_${useVertexColors ? 'vc' : 'std'}`;
  let mat = _FAMILY_MATERIAL_CACHE.get(cacheKey);
  if (mat) return mat;

  const spec = BUILDING_FACADE_FAMILIES[familyKey] || BUILDING_FACADE_FAMILIES.curtain_glass;
  const { map, emissiveMap } = getOrBuildFamilyTexturePair(familyKey);

  mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: useVertexColors,
    map,
    emissive: new THREE.Color(0xffffff),
    emissiveMap,
    emissiveIntensity: 0.0,
    roughness: spec.roughness,
    metalness: spec.metalness
  });
  markAsSharedAsset(mat);
  mat.userData.isBuildingFacadeFamily = true;
  mat.userData.isDynamicMaterial = true;
  mat.userData.familyKey = familyKey;

  _FAMILY_MATERIAL_CACHE.set(cacheKey, mat);
  return mat;
}

export function getStyleVertexTintColor(styleKey, seedVariant = 0) {
  const safeKey = STYLE_BASE_TINTS[styleKey] ? styleKey : 'sapphire_glass';
  const vIdx = Math.abs(Math.trunc(Number(seedVariant) || 0)) % SEED_MODULATORS.length;
  const cacheKey = `${safeKey}_${vIdx}`;
  let cached = _STYLE_TINT_CACHE.get(cacheKey);
  if (!cached) {
    const base = STYLE_BASE_TINTS[safeKey];
    const mod = SEED_MODULATORS[vIdx];
    cached = new THREE.Color(
      THREE.MathUtils.clamp(base[0] * mod[0], 0, 1),
      THREE.MathUtils.clamp(base[1] * mod[1], 0, 1),
      THREE.MathUtils.clamp(base[2] * mod[2], 0, 1)
    );
    _STYLE_TINT_CACHE.set(cacheKey, cached);
  }
  return cached.clone();
}

export function ensureGeometryVertexColor(geo, color) {
  if (!geo || geo.isRawBox || !geo.attributes?.position) return geo;
  const count = geo.attributes.position.count;
  const c = color instanceof THREE.Color ? color : new THREE.Color(color ?? 0xffffff);
  const existing = geo.attributes.color;
  const arr = existing && existing.count === count ? existing.array : new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  if (!existing || existing.count !== count) {
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  } else {
    existing.needsUpdate = true;
  }
  return geo;
}

export function getAllFacadeFamilyMaterials() {
  return Array.from(_FAMILY_MATERIAL_CACHE.values());
}
