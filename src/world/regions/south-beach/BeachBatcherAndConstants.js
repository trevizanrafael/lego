import * as THREE from 'three';
import { makeFastBox, flushSpatialChunkedBuckets } from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';

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

// Os 3 Canais estilo Santos que descem da Avenida Beira-Mar e cortam a areia até o mar!
export const SANTOS_CANALS_X = [-384, -120, 252];
export const CANAL_WIDTH = 22;

export function isInsideSantosCanal(x, margin = 14) {
  for (const cx of SANTOS_CANALS_X) {
    if (Math.abs(x - cx) < CANAL_WIDTH * 0.5 + margin) return true;
  }
  return false;
}

/**
 * Acumulador de Geometrias 3D da Orla Sul (Canais, Calçadão, Areia, Quiosques, Mega Píer & Farol)
 */
export class SouthBeachBatcher {
  constructor() {
    this.buckets = new Map();
    this.materials = new Map();
    this._initMaterials();
  }

  _registerMat(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    if (opts.basic) {
      this.materials.set(key, new THREE.MeshBasicMaterial({ color: colorHex }));
    } else {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: opts.roughness ?? 0.3,
          metalness: opts.metalness ?? 0.06,
          emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
          emissiveIntensity: opts.emissiveIntensity ?? 0,
          polygonOffset: Boolean(opts.polygonOffset),
          polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
          polygonOffsetUnits: opts.polygonOffsetUnits ?? 0
        })
      );
    }
  }

  _initMaterials() {
    for (const t of TROPICAL_WALL_KEYS) {
      this._registerMat(t.key, t.hex, { roughness: 0.24 });
    }
    this._registerMat('trim_white', 0xffffff, { roughness: 0.22 });
    this._registerMat('stone_black', 0x18181b, { roughness: 0.55 });
    this._registerMat('stone_grey', 0x64748b, { roughness: 0.52 });
    this._registerMat('stone_white', 0xf1f5f9, { roughness: 0.48 });
    this._registerMat('bike_red', 0xb91c1c, { roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this._registerMat('glass_cyan', 0x38bdf8, {
      roughness: 0.12,
      metalness: 0.28,
      emissive: 0x0284c7,
      emissiveIntensity: 0.24
    });
    this._registerMat('glass_sapphire', 0x1d4ed8, {
      roughness: 0.14,
      metalness: 0.32,
      emissive: 0x1e40af,
      emissiveIntensity: 0.22
    });
    this._registerMat('window_warm', 0xfef08a, { basic: true });
    this._registerMat('neon_pink', 0xf43f5e, { basic: true });
    this._registerMat('neon_cyan', 0x00f0ff, { basic: true });
    this._registerMat('neon_gold', 0xfacc15, { basic: true });
    this._registerMat('pool_water', 0x06b6d4, {
      roughness: 0.08,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35
    });
    this._registerMat('canal_water', 0x0284c7, {
      roughness: 0.12,
      emissive: 0x0369a1,
      emissiveIntensity: 0.2
    });
    this._registerMat('palm_trunk', 0x78350f, { roughness: 0.52 });
    this._registerMat('palm_leaf', 0x16a34a, { roughness: 0.32 });
    this._registerMat('coconut_brown', 0x451a03, { roughness: 0.45 });
    this._registerMat('wood_pier', 0x7c2d12, { roughness: 0.48 });
    this._registerMat('wood_pilings', 0x451a03, { roughness: 0.62 });
    this._registerMat('wood_deck', 0xb45309, { roughness: 0.42 });
    this._registerMat('sand_wet', 0x7d6a49, { roughness: 0.68 });
    this._registerMat('surf_foam', 0xf8fafc, { basic: true });

    this._registerMat('umb_red', 0xef4444, { roughness: 0.26 });
    this._registerMat('umb_blue', 0x2563eb, { roughness: 0.26 });
    this._registerMat('umb_orange', 0xf97316, { roughness: 0.26 });
    this._registerMat('umb_turquoise', 0x06b6d4, { roughness: 0.26 });
    this._registerMat('umb_pink', 0xec4899, { roughness: 0.26 });
    this._registerMat('umb_green', 0x22c55e, { roughness: 0.26 });
    this._registerMat('umb_yellow', 0xfacc15, { roughness: 0.26 });
  }

  addBox(key, w, h, d, x, y, z) {
    const arr = this.buckets.get(key);
    if (!arr) return;
    arr.push(makeFastBox(w, h, d, x, y, z));
  }

  flush(scene) {
    flushSpatialChunkedBuckets(scene, this.buckets, this.materials, {
      chunkSize: 768,
      castShadowFn: (key, mat) =>
        !mat.isMeshBasicMaterial &&
        (key.startsWith('coastal_') ||
          key.startsWith('umb_') ||
          key === 'palm_trunk' ||
          key === 'palm_leaf' ||
          key === 'wood_pier'),
      receiveShadowFn: () => true
    });
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
    batcher.addBox('palm_trunk', w, segH, w, curX, curY + segH * 0.5, curZ);
    curY += segH * 0.92;
  }

  batcher.addBox('coconut_brown', 0.42 * scale, 0.42 * scale, 0.42 * scale, curX + 0.28, curY - 0.15, curZ + 0.22);
  batcher.addBox('coconut_brown', 0.42 * scale, 0.42 * scale, 0.42 * scale, curX - 0.26, curY - 0.15, curZ + 0.24);

  const frondDirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]
  ];
  for (const [dx, dz] of frondDirs) {
    const f1X = curX + dx * 1.45 * scale;
    const f1Z = curZ + dz * 1.45 * scale;
    const w1 = Math.abs(dx) > 0.5 ? 2.4 * scale : 0.95 * scale;
    const d1 = Math.abs(dz) > 0.5 ? 2.4 * scale : 0.95 * scale;
    batcher.addBox('palm_leaf', w1, 0.32 * scale, d1, f1X, curY + 0.28 * scale, f1Z);

    const f2X = curX + dx * 2.85 * scale;
    const f2Z = curZ + dz * 2.85 * scale;
    const w2 = Math.abs(dx) > 0.5 ? 1.65 * scale : 0.78 * scale;
    const d2 = Math.abs(dz) > 0.5 ? 1.65 * scale : 0.78 * scale;
    batcher.addBox('palm_leaf', w2, 0.28 * scale, d2, f2X, curY - 0.22 * scale, f2Z);
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
