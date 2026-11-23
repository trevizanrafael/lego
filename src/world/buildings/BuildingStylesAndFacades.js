import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import {
  BUILDING_FACADE_FAMILIES,
  STYLE_TO_FAMILY_MAP,
  getFacadeFamilyKeyForStyle,
  getFamilyFacadeMaterialForStyle,
  getStyleVertexTintColor,
  ensureGeometryVertexColor,
  getAllFacadeFamilyMaterials
} from './BuildingFamiliesAndAtlas.js';

export {
  BUILDING_FACADE_FAMILIES,
  STYLE_TO_FAMILY_MAP,
  getFacadeFamilyKeyForStyle,
  getFamilyFacadeMaterialForStyle,
  getStyleVertexTintColor,
  ensureGeometryVertexColor,
  getAllFacadeFamilyMaterials
};

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

const TRIM_MATERIAL_CACHE = new Map();

export function getFastStandardMaterial(colorHex, roughness = 0.28, metalness = 0.15) {
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
  return getAllFacadeFamilyMaterials();
}

export function getFacadeMaterial(styleKey, _seedVariant = 0) {
  // Fallback seguro sem vertexColors para malhas avulsas (ex.: ?worldScale=1 ou testes unitários isolados).
  // No mundo 3x, ChunkedBuildingLodBatcher usa os 4 materiais de família com vertexColors: true.
  return getFamilyFacadeMaterialForStyle(styleKey, { useVertexColors: false });
}
