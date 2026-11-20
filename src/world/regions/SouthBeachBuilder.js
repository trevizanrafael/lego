import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick,
  configureCrispCanvasTexture
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox, makeFastBox, flushSpatialChunkedBuckets } from '../BuildingGenerator.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';

const TROPICAL_WALL_KEYS = [
  { key: 'coastal_white', hex: 0xf8fafc, mapColor: '#f8fafc' },
  { key: 'coastal_turquoise', hex: 0x06b6d4, mapColor: '#06b6d4' },
  { key: 'coastal_aqua', hex: 0x2dd4bf, mapColor: '#2dd4bf' },
  { key: 'coastal_coral', hex: 0xfb7185, mapColor: '#fb7185' },
  { key: 'coastal_sun', hex: 0xfde047, mapColor: '#fde047' },
  { key: 'coastal_azure', hex: 0x38bdf8, mapColor: '#38bdf8' },
  { key: 'coastal_gold', hex: 0xf59e0b, mapColor: '#f59e0b' }
];

const UMBRELLA_KEYS = [
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
const CANAL_WIDTH = 22;

const BEACH_FACADE_THEMES = {
  azure_balcony: { wall: '#e2e8f0', slab: '#f8fafc', glass: '#0c4a6e', glassHi: '#38bdf8', warmWin: '#fef08a', glow: '#38bdf8', rough: 0.24, metal: 0.22 },
  sapphire_curtain: { wall: '#cbd5e1', slab: '#f1f5f9', glass: '#0f172a', glassHi: '#2563eb', warmWin: '#fde68a', glow: '#60a5fa', rough: 0.16, metal: 0.36 },
  gold_imperial: { wall: '#f5ebe0', slab: '#d4a373', glass: '#1e293b', glassHi: '#0ea5e9', warmWin: '#fef08a', glow: '#facc15', rough: 0.28, metal: 0.18 },
  coral_resort: { wall: '#fda4af', slab: '#fff1f2', glass: '#0e7490', glassHi: '#67e8f9', warmWin: '#fde047', glow: '#fb7185', rough: 0.26, metal: 0.14 },
  aqua_wave: { wall: '#99f6e4', slab: '#f8fafc', glass: '#164e63', glassHi: '#22d3ee', warmWin: '#fef08a', glow: '#2dd4bf', rough: 0.18, metal: 0.28 },
  sand_terrace: { wall: '#fef08a', slab: '#ffffff', glass: '#1e3a8a', glassHi: '#38bdf8', warmWin: '#fed7aa', glow: '#f59e0b', rough: 0.30, metal: 0.12 },
  aurora_deco: { wall: '#f1f5f9', slab: '#334155', glass: '#1e1b4b', glassHi: '#ec4899', warmWin: '#e0f2fe', glow: '#f43f5e', rough: 0.20, metal: 0.30 },
  retail_arcade: { wall: '#1e293b', slab: '#f8fafc', glass: '#0f172a', glassHi: '#38bdf8', warmWin: '#fef08a', glow: '#facc15', rough: 0.22, metal: 0.24 }
};

const _BEACH_FACADE_CACHE = new Map();

function _getBeachFacadeMaterial(themeKey = 'azure_balcony', variant = 0) {
  const key = `${themeKey}_${variant % 2}`;
  if (_BEACH_FACADE_CACHE.has(key)) return _BEACH_FACADE_CACHE.get(key);

  const th = BEACH_FACADE_THEMES[themeKey] || BEACH_FACADE_THEMES.azure_balcony;
  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = 256;
  dayCanvas.height = 512;
  const ctx = dayCanvas.getContext('2d');

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = 256;
  nightCanvas.height = 512;
  const nctx = nightCanvas.getContext('2d');

  if (ctx && nctx) {
    ctx.fillStyle = th.wall;
    ctx.fillRect(0, 0, 256, 512);
    nctx.fillStyle = '#000000';
    nctx.fillRect(0, 0, 256, 512);

    const floors = themeKey === 'retail_arcade' ? 2 : 12;
    const cols = themeKey === 'retail_arcade' ? 4 : 6;
    const rowH = 512 / floors;
    const colW = 256 / cols;

    for (let r = 0; r < floors; r++) {
      const y = r * rowH;
      // Laje de varanda grossa e suave na textura (sem faixas finas que causem Moiré à distância!)
      ctx.fillStyle = th.slab;
      ctx.fillRect(0, y, 256, Math.max(8, rowH * 0.26));

      for (let c = 0; c < cols; c++) {
        const x = c * colW;
        const padX = Math.max(4, colW * 0.12);
        const winW = colW - padX * 2;
        const winY = y + rowH * 0.28;
        const winH = rowH * 0.66;

        // Vidraça ampla de apartamento frente-mar com gradiente sutil (zero contraste binário duro)
        ctx.fillStyle = th.glass;
        ctx.fillRect(x + padX, winY, winW, winH);
        ctx.fillStyle = th.glassHi;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x + padX + 2, winY + 2, winW * 0.42, winH - 4);
        ctx.globalAlpha = 1.0;

        // Guarda-corpo de vidro da varanda na metade inferior da janela
        ctx.fillStyle = th.slab;
        ctx.globalAlpha = 0.42;
        ctx.fillRect(x + padX, winY + winH * 0.58, winW, 4);
        ctx.globalAlpha = 1.0;

        const hash = ((r * 23 + c * 41 + variant * 17 + themeKey.length * 7) * 2654435761) >>> 0;
        const isLit = themeKey === 'retail_arcade' ? hash % 10 < 8 : hash % 10 < 5;
        if (isLit) {
          nctx.fillStyle = (hash % 7 === 0) ? th.glow : th.warmWin;
          nctx.fillRect(x + padX + 2, winY + 3, winW - 4, winH - 6);
        }
      }
    }
  }

  const dayTex = configureCrispCanvasTexture(new THREE.CanvasTexture(dayCanvas), 8);
  dayTex.wrapS = THREE.RepeatWrapping;
  dayTex.wrapT = THREE.RepeatWrapping;

  const nightTex = configureCrispCanvasTexture(new THREE.CanvasTexture(nightCanvas), 8);
  nightTex.wrapS = THREE.RepeatWrapping;
  nightTex.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshPhysicalMaterial({
    map: dayTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: nightTex,
    emissiveIntensity: 0.0,
    roughness: th.rough,
    metalness: th.metal,
    clearcoat: 0.35,
    clearcoatRoughness: 0.16
  });

  _BEACH_FACADE_CACHE.set(key, mat);
  return mat;
}

function _makeUvScaledBox(w, h, d, lx, ly, lz, tileW = 24, tileH = 44) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    if (ny > 0.5) {
      uv.setXY(i, 0.02, 0.02); // teto sem esticar janela
    } else if (nx > 0.5) {
      uv.setXY(i, ((pos.getZ(i) + d * 0.5) / tileW), ((pos.getY(i) + h * 0.5) / tileH));
    } else {
      uv.setXY(i, ((pos.getX(i) + w * 0.5) / tileW), ((pos.getY(i) + h * 0.5) / tileH));
    }
  }
  uv.needsUpdate = true;
  if (lx !== 0 || ly !== 0 || lz !== 0) {
    geo.translate(lx, ly, lz);
  }
  return geo;
}

/**
 * Construtor Limpo Local com 3 Níveis de LOD para Arranha-Céus da Orla:
 * - Elimina 100% de caixas sobrepostas / coplanares e faixas finas horizontais (zero pisca-pisca!)
 * - Usa coordenadas locais centradas em (0, 0, 0) para máxima precisão de profundidade em qualquer altitude
 */
class BeachTowerBuilder {
  constructor() {
    this.lodGroups = [new Map(), new Map(), new Map()];
    this.materials = new Map();
  }

  _getSolidMat(key, hex, opts = {}) {
    if (this.materials.has(key)) return this.materials.get(key);
    const mat = opts.basic
      ? new THREE.MeshBasicMaterial({ color: hex })
      : getLegoMaterial(hex, { roughness: opts.roughness ?? 0.28, metalness: opts.metalness ?? 0.08 });
    this.materials.set(key, mat);
    return mat;
  }

  _push(lodIdx, matKey, mat, geo) {
    const map = this.lodGroups[lodIdx];
    let entry = map.get(matKey);
    if (!entry) {
      entry = { mat, geos: [] };
      map.set(matKey, entry);
    }
    entry.geos.push(geo);
  }

  addSolid(lodIdx, key, hex, w, h, d, lx, ly, lz, opts = {}) {
    const mat = this._getSolidMat(key, hex, opts);
    this._push(lodIdx, key, mat, makeTranslatedBox(w, h, d, lx, ly, lz));
  }

  addFacade(lodIdx, themeKey, variant, w, h, d, lx, ly, lz, tileW = 24, tileH = 44) {
    const matKey = `facade_${themeKey}_${variant % 2}`;
    const mat = _getBeachFacadeMaterial(themeKey, variant);
    this._push(lodIdx, matKey, mat, _makeUvScaledBox(w, h, d, lx, ly, lz, tileW, tileH));
  }

  buildLOD(worldX, worldY, worldZ) {
    const lod = new THREE.LOD();
    lod.position.set(worldX, worldY, worldZ);
    const distances = [0, 360, 1050];

    for (let li = 0; li < 3; li++) {
      const grp = new THREE.Group();
      for (const { mat, geos } of this.lodGroups[li].values()) {
        if (!geos.length) continue;
        const merged = mergeBufferGeometries(geos);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = li === 0;
        mesh.receiveShadow = li < 2 && !mat.isMeshBasicMaterial;
        grp.add(mesh);
      }
      lod.addLevel(grp, distances[li]);
    }
    return lod;
  }
}

/**
 * Acumulador de Geometrias 3D da Orla Sul (Canais, Calçadão, Areia, Quiosques, Mega Píer & Farol)
 */
class SouthBeachBatcher {
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

function addCurvedLegoPalmTree(batcher, x, yBase, z, leanDirX = 0.25, leanDirZ = 0.85, scale = 1.0) {
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

function addNeonHotelSign(world, x, y, z, width, text, borderColor = '#00f0ff', textColor = '#facc15') {
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

/**
 * 5. SUL — REMODEL COMPLETO DOS ARRANHA-CÉUS DA ORLA (ZERO Z-FIGHTING + 3 NÍVEIS DE LOD + COMÉRCIO + VARANDAS)
 */
export function buildSouthBeachAndFerrisWheel(world) {
  const batcher = new SouthBeachBatcher();

  world.southBeachHotels = [];
  world.beachSandcastles = [];
  world.santosCanals = [];
  world.southBeachHotelLODs = [];
  world.southBeachEmissiveMats = [];

  buildCoastalHotelBlocks(world, batcher);
  buildSantosStyleBeachCanals(world, batcher);
  buildOceanfrontBoardwalkAndKiosks(world, batcher);
  buildGoldenBeachAndShorelineLife(world, batcher);
  buildMonumentalPierFerrisWheelAndMarina(world, batcher);
  buildSouthwestPointLighthouseDunesAndWestMarina(world, batcher);

  for (const mat of _BEACH_FACADE_CACHE.values()) {
    world.southBeachEmissiveMats.push(mat);
  }

  batcher.flush(world.scene);
}

function _addResortPodiumAndRetail(tb, w, d, podiumH, accentHex, seed, hasSidewalkTables = true) {
  // Alicerce de 8.5m para terreno em rampa
  tb.addSolid(0, 'podium_base', 0xe2e8f0, w + 0.6, 8.5, d + 0.6, 0, -4.15, 0);
  tb.addSolid(1, 'podium_base', 0xe2e8f0, w + 0.6, 8.5, d + 0.6, 0, -4.15, 0);
  tb.addSolid(2, 'podium_base', 0xe2e8f0, w + 0.6, 8.5, d + 0.6, 0, -4.15, 0);

  // Térreo comercial recuado com vitrines iluminadas (zero caixa dupla coplanar!)
  const retailW = w - 3.6;
  const retailD = d - 3.6;
  tb.addFacade(0, 'retail_arcade', seed, retailW, podiumH - 1.2, retailD, 0, (podiumH - 1.2) * 0.5, 0, 14, 7.5);
  tb.addFacade(1, 'retail_arcade', seed, retailW, podiumH - 1.2, retailD, 0, (podiumH - 1.2) * 0.5, 0, 14, 7.5);
  tb.addSolid(2, 'podium_core', 0x334155, retailW, podiumH - 1.2, retailD, 0, (podiumH - 1.2) * 0.5, 0);

  // Laje superior do pódio (separa pódio da torre sem sobreposição)
  tb.addSolid(0, 'podium_cap', 0xf8fafc, w, 1.2, d, 0, podiumH - 0.6, 0);
  tb.addSolid(1, 'podium_cap', 0xf8fafc, w, 1.2, d, 0, podiumH - 0.6, 0);
  tb.addSolid(2, 'podium_cap', 0xf8fafc, w, 1.2, d, 0, podiumH - 0.6, 0);

  // Pilares estruturais externos nos 4 cantos (afastados das paredes!)
  const pxOff = w * 0.5 - 1.0;
  const pzOff = d * 0.5 - 1.0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      tb.addSolid(0, 'podium_pier', 0xffffff, 2.0, podiumH - 1.2, 2.0, sx * pxOff, (podiumH - 1.2) * 0.5, sz * pzOff);
    }
  }

  // Toldos comerciais e mesinhas na calçada frontal (+Z) apenas em LOD 0
  if (hasSidewalkTables) {
    const awningZ = d * 0.5 + 1.25;
    const stepX = Math.max(11, w * 0.34);
    const paletteCols = [0xef4444, 0x06b6d4, 0xf97316, 0x22c55e, 0xfacc15, accentHex];
    let idx = 0;
    for (let ax = -w * 0.32; ax <= w * 0.32; ax += stepX) {
      const col = paletteCols[(seed + idx++) % paletteCols.length];
      tb.addSolid(0, `awning_${idx % 3}`, col, 8.2, 0.55, 2.5, ax, 4.6, awningZ);
      tb.addSolid(0, 'cafe_table', 0xffffff, 1.4, 0.8, 1.4, ax, 0.4, awningZ + 1.4);
      tb.addSolid(0, `cafe_umb_${idx % 3}`, col, 2.5, 0.36, 2.5, ax, 2.35, awningZ + 1.4);
    }
  }
}

function _addCleanBalconiesLOD0(tb, bx, byBase, bz, bw, bd, height, intervalY = 19, balconyHex = 0xf8fafc, railHex = 0x38bdf8) {
  // Sacadas espessas e espaçadas (zero serrilhado/Moiré a distância, e zero intersecção coplanar!)
  const frontZ = bz + bd * 0.5;
  for (let fy = byBase + 10; fy < byBase + height - 6; fy += intervalY) {
    // Laje projetada para frente (+2.4m além da fachada)
    tb.addSolid(0, 'balc_slab', balconyHex, bw - 3.0, 0.95, 2.4, bx, fy, frontZ + 1.2);
    // Guarda-corpo de vidro apoiado sobre a laje (sem cortar a parede!)
    tb.addSolid(0, 'balc_glass', railHex, bw - 3.4, 1.05, 0.24, bx, fy + 1.0, frontZ + 2.28, {
      roughness: 0.14,
      metalness: 0.28
    });
  }
}

function buildCoastalHotelBlocks(world, batcher) {
  const hotelColsX = [-582, -450, -318, -186, -60, 60, 186, 318, 450];

  // 1.1 Fileira Traseira "Quadra Mar" (Z = 480): 18 Torres Residenciais Costeiras (38 a 52 andares)
  hotelColsX.forEach((hx, idx) => {
    const bw = Math.abs(hx) === 60 ? 92 : 104;
    const bd = 96;
    const innerW = bw - 10;
    const innerD = bd - 10;
    world._addCityBlockSidewalk(hx, 480, bw, bd, LEGO_COLORS.sidewalk);

    const lotW = (innerW - 6) * 0.5;
    const floors1 = 38 + (idx % 4) * 4;
    const floors2 = 42 + ((idx + 2) % 4) * 3;
    buildGenericHighRiseResort(world, batcher, hx - (lotW + 6) * 0.5, 480, lotW, innerD, floors1, idx * 2, false);
    buildGenericHighRiseResort(world, batcher, hx + (lotW + 6) * 0.5, 480, lotW, innerD, floors2, idx * 2 + 1, false);
  });

  // 1.2 Orla Oeste (X = -955..-582 em Z = 630): Torres Costeiras Remodeladas
  for (const [edgeX, seedIdx, bwEdge, floorsLeft, floorsRight, labelText] of [
    [-955, 2, 114, 46, 50, 'RESORT PONTA OESTE'],
    [-832, 4, 114, 48, 54, 'MIRANTE CAMBORIÚ TOWER'],
    [-710, 6, 114, 52, 56, 'COSTA ESMERALDA TWIN'],
    [-582, 0, 104, 50, 55, 'ATLÂNTICO SUL RESIDENCE']
  ]) {
    world._addCityBlockSidewalk(edgeX, 630, bwEdge, 96, LEGO_COLORS.sidewalk);
    const innerW = bwEdge - 10;
    const lotW = (innerW - 6) * 0.5;
    buildGenericHighRiseResort(
      world,
      batcher,
      edgeX - (lotW + 6) * 0.5,
      630,
      lotW,
      86,
      floorsLeft,
      seedIdx,
      true,
      labelText
    );
    buildGenericHighRiseResort(
      world,
      batcher,
      edgeX + (lotW + 6) * 0.5,
      630,
      lotW,
      86,
      floorsRight,
      seedIdx + 1,
      true,
      null
    );
  }

  // Parque Linear & Estacionamento Costeiro Oeste
  world._addCityBlockSidewalk(-1420, 690, 810, 52, LEGO_COLORS.sidewalk);
  batcher.addBox('palm_leaf', 796, 0.22, 24, -1420, 0.35, 682);
  for (let px = -1790; px <= -1040; px += 46) {
    addCurvedLegoPalmTree(batcher, px, 0.32, 682, 0.16, 0.85, 1.15);
  }

  // 1.3 OS 8 SUPER-ARRANHA-CÉUS EXCLUSIVOS DA ORLA REMODELADOS (Z = 630, 232m a 296m!)
  const signatureSpecs = [
    { x: -450, bw: 104, styleId: 1, floors: 68, height: 264, name: 'YACHTHOUSE TWIN TOWERS', color: '#06b6d4' },
    { x: -318, bw: 104, styleId: 2, floors: 74, height: 284, name: 'ONE TOWER BURJ NÁUTICO', color: '#38bdf8' },
    { x: -186, bw: 104, styleId: 3, floors: 60, height: 232, name: 'MILLENNIUM PALACE ROYAL', color: '#facc15' },
    { x: -60, bw: 92, styleId: 4, floors: 78, height: 296, name: 'SOLARIS INFINITY COAST', color: '#fb7185' },
    { x: 60, bw: 92, styleId: 5, floors: 72, height: 276, name: 'EPIC WAVE DIAMOND TOWER', color: '#2dd4bf' },
    { x: 186, bw: 104, styleId: 6, floors: 64, height: 246, name: 'BOREAL HANGING GARDENS', color: '#fde047' },
    { x: 318, bw: 104, styleId: 7, floors: 68, height: 260, name: 'AURORA NEON GRAND TOWER', color: '#ec4899' },
    { x: 450, bw: 104, styleId: 8, floors: 62, height: 240, name: 'PHAROS PANORAMA SUITES', color: '#06b6d4' }
  ];

  signatureSpecs.forEach((spec) => {
    const bz = 630;
    const bd = 96;
    const w = spec.bw - 10;
    const d = bd - 10;
    world._addCityBlockSidewalk(spec.x, bz, spec.bw, bd, LEGO_COLORS.sidewalk);

    buildSignatureOceanfrontHotel(world, batcher, spec.x, bz, w, d, spec);

    const palmLY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(spec.x - w * 0.38, 675.5) : 0) + 0.3;
    const palmRY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(spec.x + w * 0.38, 675.5) : 0) + 0.3;
    addCurvedLegoPalmTree(batcher, spec.x - w * 0.38, palmLY, 675.5, -0.18, 0.78, 1.15);
    addCurvedLegoPalmTree(batcher, spec.x + w * 0.38, palmRY, 675.5, 0.18, 0.78, 1.15);
  });
}

function buildGenericHighRiseResort(world, batcher, x, z, w, d, floors, seed, isFrontRow = false, signText = null) {
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = terrainY + 0.3;
  const podiumH = 8.0;
  const floorH = 3.8;
  const totalH = podiumH + (floors - 1) * floorH;
  const palette = TROPICAL_WALL_KEYS[seed % TROPICAL_WALL_KEYS.length];
  const themeKeys = ['azure_balcony', 'sapphire_curtain', 'coral_resort', 'aqua_wave', 'sand_terrace'];
  const themeKey = themeKeys[seed % themeKeys.length];

  const tb = new BeachTowerBuilder();
  _addResortPodiumAndRetail(tb, w, d, podiumH, palette.hex, seed, isFrontRow);

  // Massa escalonada em 2 segmentos sem faces sobrepostas (silhueta variada)
  const lowerW = w - 4.0;
  const lowerD = d - 6.0;
  const splitRatio = seed % 3 === 0 ? 0.56 : seed % 3 === 1 ? 0.68 : 0.62;
  const lowerH = (totalH - podiumH) * splitRatio;
  const upperH = totalH - podiumH - lowerH;
  const upperW = Math.max(14, lowerW - (seed % 2 === 0 ? 8 : 5));
  const upperD = Math.max(14, lowerD - (seed % 2 === 0 ? 8 : 10));
  const upperZOff = isFrontRow ? -3.0 : 0;

  // Bloco inferior + Bloco superior empilhados perfeitamente sem interseção!
  for (let li = 0; li < 2; li++) {
    tb.addFacade(li, themeKey, seed, lowerW, lowerH, lowerD, 0, podiumH + lowerH * 0.5, 0, 22, 42);
    tb.addFacade(li, themeKey, seed + 1, upperW, upperH, upperD, 0, podiumH + lowerH + upperH * 0.5, upperZOff, 20, 40);
  }
  tb.addSolid(2, 'lod2_lower', palette.hex, lowerW, lowerH, lowerD, 0, podiumH + lowerH * 0.5, 0);
  tb.addSolid(2, 'lod2_upper', 0x38bdf8, upperW, upperH, upperD, 0, podiumH + lowerH + upperH * 0.5, upperZOff);

  // Colunas externas nos flancos em LOD 0 + 1 (afastadas da fachada em ±lowerW*0.5+0.9, nunca coplanar!)
  for (let li = 0; li < 2; li++) {
    for (const sx of [-1, 1]) {
      tb.addSolid(
        li,
        'side_fin',
        0xf8fafc,
        1.8,
        lowerH,
        lowerD * 0.72,
        sx * (lowerW * 0.5 + 0.9),
        podiumH + lowerH * 0.5,
        0
      );
    }
  }

  // Varandas amplas em LOD 0 apenas nas faces limpas
  _addCleanBalconiesLOD0(tb, 0, podiumH, 0, lowerW, lowerD, lowerH, 19.0, 0xf8fafc, 0x38bdf8);
  _addCleanBalconiesLOD0(tb, 0, podiumH + lowerH, upperZOff, upperW, upperD, upperH, 20.0, 0xffffff, 0x2dd4bf);

  // Cobertura com piscina infinita, pérgola e coroa
  const deckY = podiumH + lowerH;
  tb.addSolid(0, 'deck_trim', 0xffffff, lowerW + 1.4, 1.2, lowerD + 1.4, 0, deckY + 0.6, 0);
  if (isFrontRow) {
    tb.addSolid(0, 'deck_pool', 0x06b6d4, upperW * 0.7, 0.6, 5.2, 0, deckY + 1.4, lowerD * 0.34);
  }
  tb.addSolid(0, 'crown_cap', palette.hex, upperW * 0.58, 5.0, upperD * 0.52, 0, totalH + 2.5, upperZOff);
  tb.addSolid(1, 'crown_cap', palette.hex, upperW * 0.58, 5.0, upperD * 0.52, 0, totalH + 2.5, upperZOff);
  tb.addSolid(0, 'spire', 0xfacc15, 1.1, 11.0, 1.1, 0, totalH + 10.5, upperZOff, { basic: true });

  const lod = tb.buildLOD(x, yBase, z);
  world.scene.add(lod);
  world.southBeachHotelLODs.push(lod);

  const roofY = yBase + totalH;
  if (signText) {
    addNeonHotelSign(world, x, roofY + 4.5, z + upperD * 0.5 + upperZOff + 1.6, 34, signText);
  }

  world.addCollider(x, z, w, d, roofY + 2.0, yBase);
  world.mapBuildings.push({ x, z, w, d, height: totalH, color: palette.mapColor, label: signText || 'TORRE QUADRA MAR' });
  world.southBeachHotels.push({ x, z, w, d, floors, height: totalH, hasRooftopPool: true, isFrontRow });
}

function buildSignatureOceanfrontHotel(world, batcher, x, z, w, d, spec) {
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = terrainY + 0.3;
  const podiumH = 9.0;
  const totalH = spec.height;
  const bodyH = totalH - podiumH;
  const H = yBase + totalH;

  const tb = new BeachTowerBuilder();
  _addResortPodiumAndRetail(tb, w, d, podiumH, parseInt(spec.color.replace('#', ''), 16), spec.styleId, true);

  if (spec.styleId === 1) {
    // 1. YACHTHOUSE TWIN TOWERS — Gêmeas com skybridges limpos e sem caixas coplanares
    const tw = (w - 16) * 0.5;
    const td = d - 8;
    for (const sx of [-1, 1]) {
      const tx = sx * (tw * 0.5 + 5.0);
      for (let li = 0; li < 2; li++) {
        tb.addFacade(li, 'sapphire_curtain', sx + 1, tw, bodyH, td, tx, podiumH + bodyH * 0.5, 0, 22, 42);
        tb.addSolid(li, 'sail_fin', 0xffffff, 2.2, bodyH + 8, td * 0.72, tx + sx * (tw * 0.5 + 1.1), podiumH + (bodyH + 8) * 0.5, 0);
      }
      tb.addSolid(2, 'lod2_yacht', 0x38bdf8, tw, bodyH, td, tx, podiumH + bodyH * 0.5, 0);
      _addCleanBalconiesLOD0(tb, tx, podiumH, 0, tw, td, bodyH, 20.0, 0xf8fafc, 0x06b6d4);
      tb.addSolid(0, 'crown_wht', 0xffffff, tw - 4, 8.5, td - 8, tx, totalH + 4.25, 0);
      tb.addSolid(1, 'crown_wht', 0xffffff, tw - 4, 8.5, td - 8, tx, totalH + 4.25, 0);
      tb.addSolid(0, 'crown_spire', 0x00f0ff, 1.4, 15, 1.4, tx, totalH + 16.0, 0, { basic: true });
    }
    // Skybridges suspensos entre as duas torres (sem penetrar as fachadas frontais!)
    for (const [sy, sh, sd, hasPool] of [[112, 6.2, 18, false], [202, 7.6, 24, true]]) {
      const bridgeW = 10.0;
      tb.addSolid(0, 'skybridge', 0xffffff, bridgeW, sh, sd, 0, sy, 2);
      tb.addSolid(1, 'skybridge', 0xffffff, bridgeW, sh, sd, 0, sy, 2);
      if (hasPool) tb.addSolid(0, 'pool', 0x06b6d4, bridgeW - 1.2, 0.9, sd - 4, 0, sy + sh * 0.5 + 0.45, 2);
    }
    addNeonHotelSign(world, x, yBase + 207, z + 15.5, 38, spec.name, '#00f0ff', '#facc15');
  } else if (spec.styleId === 2) {
    // 2. ONE TOWER BURJ NÁUTICO — 5 Estágios Escalonados + Pináculo
    const tiers = [
      { h: 62, w: w - 4, d: d - 4, zOff: 0 },
      { h: 58, w: w - 14, d: d - 10, zOff: -2.0 },
      { h: 56, w: w - 24, d: d - 16, zOff: -4.0 },
      { h: 52, w: w - 36, d: d - 22, zOff: -6.0 },
      { h: Math.max(30, bodyH - 228), w: w - 48, d: d - 28, zOff: -8.0 }
    ];
    let curY = podiumH;
    tiers.forEach((t, ti) => {
      for (let li = 0; li < 2; li++) {
        tb.addFacade(li, 'sapphire_curtain', ti, t.w, t.h, t.d, 0, curY + t.h * 0.5, t.zOff, 22, 42);
      }
      tb.addSolid(2, 'lod2_one', 0x1d4ed8, t.w, t.h, t.d, 0, curY + t.h * 0.5, t.zOff);
      _addCleanBalconiesLOD0(tb, 0, curY, t.zOff, t.w, t.d, t.h, 21.0, 0xf8fafc, 0x38bdf8);
      tb.addSolid(0, 'tier_trim', 0xf8fafc, t.w + 1.2, 1.2, t.d + 1.2, 0, curY + t.h - 0.6, t.zOff);
      curY += t.h;
    });
    tb.addSolid(0, 'helipad_top', 0xf8fafc, 26, 2.0, 26, 0, curY + 1.0, -8);
    tb.addSolid(0, 'spire_cyan', 0x00f0ff, 2.0, 24.0, 2.0, 0, curY + 14.0, -8, { basic: true });
    addNeonHotelSign(world, x, yBase + 124, z + d * 0.5 + 1.2, 38, spec.name, '#38bdf8', '#ffffff');
  } else if (spec.styleId === 3) {
    // 3. MILLENNIUM PALACE ROYAL — Imperial Branco e Ouro (alas laterais + torre central sem sobrepor!)
    const wingW = 22;
    const wingH = 148;
    const wingD = d - 8;
    const centerW = w - wingW * 2 - 4;
    const centerD = d - 12;
    for (const sx of [-1, 1]) {
      const wx = sx * (centerW * 0.5 + wingW * 0.5 + 0.5);
      for (let li = 0; li < 2; li++) {
        tb.addFacade(li, 'gold_imperial', sx + 1, wingW, wingH, wingD, wx, podiumH + wingH * 0.5, 0, 18, 40);
      }
      tb.addSolid(2, 'lod2_wing', 0xf5ebe0, wingW, wingH, wingD, wx, podiumH + wingH * 0.5, 0);
      tb.addSolid(0, 'gold_cap', 0xf59e0b, wingW + 1.2, 3.6, wingD + 1.2, wx, podiumH + wingH + 1.8, 0);
    }
    for (let li = 0; li < 2; li++) {
      tb.addFacade(li, 'gold_imperial', 0, centerW, bodyH, centerD, 0, podiumH + bodyH * 0.5, -2.0, 20, 42);
    }
    tb.addSolid(2, 'lod2_palace', 0xf5ebe0, centerW, bodyH, centerD, 0, podiumH + bodyH * 0.5, -2.0);
    _addCleanBalconiesLOD0(tb, 0, podiumH, -2.0, centerW, centerD, bodyH, 22.0, 0xf59e0b, 0xfef08a);
    tb.addSolid(0, 'dome_base', 0xf59e0b, centerW * 0.72, 9.0, centerD * 0.72, 0, totalH + 4.5, -2.0);
    tb.addSolid(1, 'dome_base', 0xf59e0b, centerW * 0.72, 9.0, centerD * 0.72, 0, totalH + 4.5, -2.0);
    tb.addSolid(0, 'dome_gold', 0xfacc15, 16, 10.0, 16, 0, totalH + 14.0, -2.0, { basic: true });
    addNeonHotelSign(world, x, H + 3.5, z + centerD * 0.5 + 1.0, 38, spec.name, '#facc15', '#fef08a');
  } else if (spec.styleId === 4) {
    // 4. SOLARIS INFINITY COAST (296m) — 2 Átrios Panorâmicos Vazados com Piscinas Suspensas
    const tw = w - 4;
    const td = d - 6;
    const lowerH = 92;
    const atH = 22;
    const midH = 74;
    const upperH = Math.max(40, bodyH - lowerH - atH * 2 - midH);
    const colW = 20;

    const addBand = (yStart, hSeg, vIdx) => {
      for (let li = 0; li < 2; li++) {
        tb.addFacade(li, 'coral_resort', vIdx, tw, hSeg, td, 0, yStart + hSeg * 0.5, 0, 24, 44);
      }
      tb.addSolid(2, 'lod2_coral', 0xfb7185, tw, hSeg, td, 0, yStart + hSeg * 0.5, 0);
      _addCleanBalconiesLOD0(tb, 0, yStart, 0, tw, td, hSeg, 20.0, 0xfde047, 0x38bdf8);
    };
    const addAtrium = (yStart) => {
      for (const sx of [-1, 1]) {
        tb.addSolid(0, 'coral_col', 0xfb7185, colW, atH, td, sx * (tw * 0.5 - colW * 0.5), yStart + atH * 0.5, 0);
        tb.addSolid(1, 'coral_col', 0xfb7185, colW, atH, td, sx * (tw * 0.5 - colW * 0.5), yStart + atH * 0.5, 0);
      }
      tb.addSolid(0, 'atrium_deck', 0xf8fafc, tw - colW * 2, 1.4, td - 4, 0, yStart + 0.7, 0);
      tb.addSolid(0, 'atrium_pool', 0x06b6d4, tw - colW * 2 - 4, 0.8, 18, 0, yStart + 1.8, 4);
    };

    let yCur = podiumH;
    addBand(yCur, lowerH, 0);
    yCur += lowerH;
    addAtrium(yCur);
    yCur += atH;
    addBand(yCur, midH, 1);
    yCur += midH;
    addAtrium(yCur);
    yCur += atH;
    addBand(yCur, upperH, 2);

    tb.addSolid(0, 'solar_crown', 0xfacc15, tw + 2, 3.0, td + 2, 0, totalH + 1.5, 0, { basic: true });
    tb.addSolid(0, 'solar_pool', 0x06b6d4, tw * 0.6, 0.9, 16, 0, totalH + 3.4, 8);
    tb.addSolid(0, 'solar_spire', 0xfacc15, 2.0, 18.0, 2.0, 0, totalH + 12.0, -8, { basic: true });
    addNeonHotelSign(world, x, H + 5.5, z + td * 0.5 + 1.6, 38, spec.name, '#fb7185', '#fde047');
  } else if (spec.styleId === 5) {
    // 5. EPIC WAVE DIAMOND TOWER — Fachada Cristal + Coluna Panorâmica Externa (afastada!)
    const tw = w - 6;
    const td = d - 8;
    for (let li = 0; li < 2; li++) {
      tb.addFacade(li, 'aqua_wave', 0, tw, bodyH, td, 0, podiumH + bodyH * 0.5, 0, 22, 42);
      // Coluna externa do elevador totalmente fora da fachada (Z = +td*0.5 + 2.4)!
      tb.addSolid(li, 'elev_frame', 0xf8fafc, 6.4, bodyH + 8, 3.6, 0, podiumH + (bodyH + 8) * 0.5, td * 0.5 + 2.0);
    }
    tb.addSolid(0, 'elev_neon', 0x00f0ff, 2.6, bodyH + 6, 0.8, 0, podiumH + (bodyH + 6) * 0.5, td * 0.5 + 4.2, { basic: true });
    tb.addSolid(2, 'lod2_wave', 0x2dd4bf, tw, bodyH, td, 0, podiumH + bodyH * 0.5, 0);
    _addCleanBalconiesLOD0(tb, -tw * 0.27, podiumH, 0, tw * 0.36, td, bodyH, 20.0, 0xf8fafc, 0x2dd4bf);
    _addCleanBalconiesLOD0(tb, tw * 0.27, podiumH, 0, tw * 0.36, td, bodyH, 20.0, 0xf8fafc, 0x2dd4bf);
    tb.addSolid(0, 'wave_crown', 0x00f0ff, tw * 0.44, 10.0, td * 0.44, 0, totalH + 5.0, -6, { basic: true });
    addNeonHotelSign(world, x, H + 5.5, z + td * 0.5 + 4.4, 38, spec.name, '#00f0ff', '#ffffff');
  } else if (spec.styleId === 6) {
    // 6. BOREAL HANGING GARDENS — 7 Terraços Escalonados Frente-Mar com Jardins Suspensos
    const steps = 7;
    const stepH = bodyH / steps;
    let curY = podiumH;
    for (let s = 0; s < steps; s++) {
      const sw = w - 4 - s * 8.5;
      const sd = d - 6 - s * 6.8;
      const zOff = -s * 2.4;
      for (let li = 0; li < 2; li++) {
        tb.addFacade(li, s % 2 === 0 ? 'sand_terrace' : 'coral_resort', s, sw, stepH - 1.0, sd, 0, curY + (stepH - 1.0) * 0.5, zOff, 20, 36);
        tb.addSolid(li, 'terrace_slab', 0xffffff, sw + 1.4, 1.0, sd + 1.4, 0, curY + stepH - 0.5, zOff);
      }
      tb.addSolid(2, 'lod2_gardens', 0xfde047, sw, stepH, sd, 0, curY + stepH * 0.5, zOff);
      const terraceZ = zOff + sd * 0.5 - 3.0;
      tb.addSolid(0, 't_pool', 0x06b6d4, sw * 0.48, 0.55, 4.6, 0, curY + stepH + 0.3, terraceZ);
      addCurvedLegoPalmTree(batcher, x - sw * 0.34, yBase + curY + stepH, z + terraceZ, -0.18, 0.75, 0.85);
      addCurvedLegoPalmTree(batcher, x + sw * 0.34, yBase + curY + stepH, z + terraceZ, 0.18, 0.75, 0.85);
      curY += stepH;
    }
    tb.addSolid(0, 'gold_spire', 0xfacc15, 2.0, 18.0, 2.0, 0, totalH + 9.0, -14, { basic: true });
    addNeonHotelSign(world, x, H + 4.0, z - 9, 38, spec.name, '#fde047', '#fb7185');
  } else if (spec.styleId === 7) {
    // 7. AURORA NEON GRAND TOWER — Art-Déco Escalonado Branco & Rosa com Pilastras Limpas
    const tw = w - 6;
    const td = d - 8;
    const flankH = bodyH * 0.82;
    for (let li = 0; li < 2; li++) {
      tb.addFacade(li, 'aurora_deco', 0, tw, flankH, td, 0, podiumH + flankH * 0.5, 0, 22, 42);
      tb.addFacade(li, 'aurora_deco', 1, tw * 0.58, bodyH - flankH, td * 0.72, 0, podiumH + flankH + (bodyH - flankH) * 0.5, -3.0, 20, 40);
    }
    tb.addSolid(2, 'lod2_aurora', 0xec4899, tw, bodyH, td, 0, podiumH + bodyH * 0.5, 0);
    for (const nx of [-tw * 0.36, tw * 0.36]) {
      tb.addSolid(0, 'aurora_neon', 0x00f0ff, 1.4, flankH + 4, 1.4, nx, podiumH + (flankH + 4) * 0.5, td * 0.5 + 1.0, { basic: true });
    }
    _addCleanBalconiesLOD0(tb, 0, podiumH, 0, tw, td, flankH, 21.0, 0xf8fafc, 0xec4899);
    tb.addSolid(0, 'aurora_crown', 0x00f0ff, tw * 0.42, 10.0, td * 0.42, 0, totalH + 5.0, -3.0, { basic: true });
    addNeonHotelSign(world, x, H + 4.8, z + td * 0.5 + 1.6, 38, spec.name, '#ec4899', '#00f0ff');
  } else {
    // 8. PHAROS PANORAMA SUITES — Torre Turquesa Chanfrada + Observatório 360° no Topo!
    const tw = w - 12;
    const td = d - 12;
    for (let li = 0; li < 2; li++) {
      tb.addFacade(li, 'azure_balcony', 1, tw, bodyH, td, 0, podiumH + bodyH * 0.5, 0, 22, 42);
      // Pilastras de canto externas sem cruzar a face!
      for (const sx of [-1, 1]) {
        tb.addSolid(li, 'pharos_col', 0xffffff, 4.2, bodyH + 4, td * 0.56, sx * (tw * 0.5 + 2.1), podiumH + (bodyH + 4) * 0.5, 0);
      }
    }
    tb.addSolid(2, 'lod2_pharos', 0x06b6d4, tw, bodyH, td, 0, podiumH + bodyH * 0.5, 0);
    _addCleanBalconiesLOD0(tb, 0, podiumH, 0, tw, td, bodyH, 20.0, 0xffffff, 0x06b6d4);

    // Restaurante Panorâmico no Topo
    tb.addSolid(0, 'obs_base', 0xffffff, tw + 8, 2.8, td + 8, 0, totalH + 1.4, 0);
    tb.addFacade(0, 'retail_arcade', 1, tw + 6, 6.2, td + 6, 0, totalH + 5.9, 0, 16, 8);
    tb.addSolid(0, 'obs_cap', 0xef4444, tw - 4, 3.2, td - 4, 0, totalH + 10.6, 0);
    tb.addSolid(1, 'obs_base', 0xffffff, tw + 8, 9.0, td + 8, 0, totalH + 4.5, 0);
    tb.addSolid(0, 'obs_spire', 0xfacc15, 2.0, 18.0, 2.0, 0, totalH + 19.0, 0, { basic: true });
    addNeonHotelSign(world, x, H + 4.5, z + td * 0.5 + 4.2, 38, spec.name, '#06b6d4', '#fde047');
  }

  const lod = tb.buildLOD(x, yBase, z);
  world.scene.add(lod);
  world.southBeachHotelLODs.push(lod);

  world.addCollider(x, z, w, d, H + 4.0, yBase);
  world.mapBuildings.push({
    x,
    z,
    w,
    d,
    height: H,
    color: spec.color,
    label: spec.name
  });
  world.southBeachHotels.push({
    x,
    z,
    w,
    d,
    floors: spec.floors,
    height: H,
    hasRooftopPool: true,
    isFrontRow: true,
    styleId: spec.styleId
  });
}

/**
 * 2. OS 3 CANAIS ESTILO SANTOS (Canal 1, Canal 2 e Canal 3):
 * Descem da Avenida Beira-Mar (Z = 720), cortam o Calçadão e dividem a Areia da Praia até desaguar no Oceano (Z = 1068)!
 */
function buildSantosStyleBeachCanals(world, batcher) {
  SANTOS_CANALS_X.forEach((cx, idx) => {
    const canalNum = idx + 1;
    const canalZStart = 724;
    const canalZEnd = 1066;
    const canalLen = canalZEnd - canalZStart;
    const canalCenterZ = (canalZStart + canalZEnd) * 0.5;

    // 1. Leito de Água Azul-Profundo do Canal correndo da Avenida até o Mar!
    batcher.addBox('canal_water', CANAL_WIDTH - 2.4, 0.35, canalLen, cx, -0.18, canalCenterZ);
    world.mapWater.push({ x: cx, z: canalCenterZ, w: CANAL_WIDTH, d: canalLen });

    // 2. Paredões Laterais de Concreto & Muretas Brancas/Azuis Clássicas de Santos
    const leftWallX = cx - CANAL_WIDTH * 0.5;
    const rightWallX = cx + CANAL_WIDTH * 0.5;
    for (const wx of [leftWallX, rightWallX]) {
      batcher.addBox('stone_grey', 1.8, 1.4, canalLen, wx, 0.1, canalCenterZ);
      // Mureta de proteção superior (interrompida apenas na passarela da areia Z=910)
      batcher.addBox('trim_white', 0.85, 0.85, 165, wx, 0.95, 810);
      batcher.addBox('umb_blue', 0.9, 0.22, 165, wx, 1.38, 810);
      batcher.addBox('trim_white', 0.85, 0.85, 120, wx, 0.95, 985);
      batcher.addBox('umb_blue', 0.9, 0.22, 120, wx, 1.38, 985);
    }

    // 3. Ponte do Calçadão & Ciclovia sobre o Canal (Z = 752, largura 52m) com Balaustrada Branca
    batcher.addBox('stone_white', CANAL_WIDTH + 4, 0.48, 52, cx, 0.24, 752);
    batcher.addBox('bike_red', CANAL_WIDTH + 4, 0.06, 4.6, cx, 0.54, 731);
    batcher.addBox('trim_white', CANAL_WIDTH + 4, 1.1, 0.6, cx, 0.8, 726.5);
    batcher.addBox('trim_white', CANAL_WIDTH + 4, 1.1, 0.6, cx, 0.8, 777.5);

    // 4. Passarela Arqueada de Pedestres & Buggies no Meio da Areia (Z = 910, largura 14m)
    batcher.addBox('wood_deck', CANAL_WIDTH + 6, 0.55, 14, cx, 0.45, 910);
    batcher.addBox('trim_white', CANAL_WIDTH + 6, 1.0, 0.45, cx, 1.1, 903.2);
    batcher.addBox('trim_white', CANAL_WIDTH + 6, 1.0, 0.45, cx, 1.1, 916.8);

    // 5. Molhes de Pedra na Boca do Canal entrando nas ondas do mar (Z = 1045..1074)
    batcher.addBox('stone_black', 3.4, 1.5, 32, leftWallX, 0.25, 1058);
    batcher.addBox('stone_black', 3.4, 1.5, 32, rightWallX, 0.25, 1058);
    batcher.addBox('surf_foam', CANAL_WIDTH + 8, 0.16, 8, cx, -0.14, 1068);

    // Placa Identificadora "CANAL 1 / 2 / 3" junto ao Calçadão
    addNeonHotelSign(world, cx, 3.6, 727, 14, `CANAL ${canalNum}`, '#38bdf8', '#ffffff');

    world.santosCanals.push({ canalNum, x: cx, width: CANAL_WIDTH, zStart: canalZStart, zEnd: canalZEnd });
  });
}

function isInsideSantosCanal(x, margin = 14) {
  for (const cx of SANTOS_CANALS_X) {
    if (Math.abs(x - cx) < CANAL_WIDTH * 0.5 + margin) return true;
  }
  return false;
}

/**
 * 3. AVENIDA BEIRA-MAR & CALÇADÃO DE COQUEIROS (Cortado pelas Pontes dos 3 Canais)
 */
function buildOceanfrontBoardwalkAndKiosks(world, batcher) {
  const bwWidth = 1920;
  const bwDepth = 52;
  const bwZ = 752;

  // Calçadão dividido em 4 trechos entre os 3 Canais (terminando em X = 538 na Foz do Rio Urbano!)
  const segmentsX = [
    [-1825, SANTOS_CANALS_X[0] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[0] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[1] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[1] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[2] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[2] + CANAL_WIDTH * 0.5, 538]
  ];

  for (const [xStart, xEnd] of segmentsX) {
    const segW = xEnd - xStart;
    const segCenterX = (xStart + xEnd) * 0.5;
    const boardwalkSeg = createLegoBrick(segW, 0.32, bwDepth, 0xf1f5f9, {
      studs: false,
      roughness: 0.45
    });
    boardwalkSeg.position.set(segCenterX, 0.16, bwZ);
    world.scene.add(boardwalkSeg);
    world.mapBlocks.push({ x: segCenterX, z: bwZ, w: segW, d: bwDepth, color: '#e2e8f0' });

    batcher.addBox('bike_red', segW, 0.05, 4.6, segCenterX, 0.365, 731);
    batcher.addBox('trim_white', segW, 0.06, 0.25, segCenterX, 0.38, 728.6);
    batcher.addBox('trim_white', segW, 0.06, 0.25, segCenterX, 0.38, 733.4);
  }

  // Padrão de Pedras Portuguesas em Ondas Pretas e Brancas sem interseção coplanar com o piso
  for (let wx = -1800; wx <= 528; wx += 16) {
    if (isInsideSantosCanal(wx, 4)) continue;
    const waveOffset = Math.sin(wx * 0.06) * 4.5;
    batcher.addBox('stone_black', 14.0, 0.04, 3.6, wx, 0.36, bwZ - 6 + waveOffset);
    batcher.addBox('stone_black', 14.0, 0.04, 3.6, wx, 0.36, bwZ + 8 - waveOffset);
  }

  for (let px = -1780; px <= 516; px += 36) {
    if (Math.abs(px) < 52 || isInsideSantosCanal(px, 12)) continue;
    const leanX = ((px % 3) - 1) * 0.22;
    addCurvedLegoPalmTree(batcher, px, 0.32, 738, leanX, 0.82, 1.12);
    if (Math.abs(px) % 72 === 0) {
      addCurvedLegoPalmTree(batcher, px + 12, 0.32, 772, -leanX, 0.9, 1.18);
    }
    batcher.addBox('trim_white', 3.4, 0.55, 0.9, px + 8, 0.58, 774.5);
    batcher.addBox('wood_deck', 3.4, 0.55, 0.22, px + 8, 0.95, 774.1);
  }

  // 4 Quiosques de Praia Centrais + 4 Quiosques da Ponta da Praia / Costão Oeste!
  const kioskXList = [-460, -250, 135, 420];
  kioskXList.forEach((kx, idx) => {
    buildBeachKiosk(world, batcher, kx, 761, idx, 'QUIOSQUE ORLA');
  });
  const westKioskXList = [-1580, -1320, -1060, -760];
  westKioskXList.forEach((kx, idx) => {
    buildBeachKiosk(world, batcher, kx, 761, idx + 2, 'QUIOSQUE PONTA DA PRAIA');
  });
}

function buildBeachKiosk(world, batcher, kx, kz, idx, label = 'QUIOSQUE ORLA') {
  const yBase = 0.32;
  const roofColor = UMBRELLA_KEYS[idx % UMBRELLA_KEYS.length];

  batcher.addBox('wood_deck', 14.0, 0.24, 14.0, kx, yBase + 0.12, kz);
  batcher.addBox('coastal_white', 8.6, 1.25, 8.6, kx, yBase + 0.75, kz);
  batcher.addBox('wood_pier', 9.4, 0.22, 9.4, kx, yBase + 1.42, kz);

  batcher.addBox('wood_pier', 3.6, 3.4, 3.6, kx, yBase + 1.8, kz - 1.0);
  batcher.addBox('coastal_turquoise', 1.8, 1.3, 1.4, kx + 2.2, yBase + 1.5, kz - 1.2);
  batcher.addBox('glass_cyan', 1.5, 1.0, 1.4, kx + 2.2, yBase + 2.65, kz - 1.2);

  for (const [dx, dz] of [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]]) {
    batcher.addBox('wood_pier', 0.45, 3.8, 0.45, kx + dx, yBase + 2.0, kz + dz);
  }
  batcher.addBox(roofColor, 12.2, 0.65, 12.2, kx, yBase + 4.1, kz);
  batcher.addBox('trim_white', 9.2, 0.65, 9.2, kx, yBase + 4.75, kz);
  batcher.addBox(roofColor, 5.6, 0.75, 5.6, kx, yBase + 5.45, kz);

  for (const [mx, mz] of [[-8.5, -3.5], [8.5, -3.5], [-8.5, 4.5], [8.5, 4.5]]) {
    const tx = kx + mx;
    const tz = kz + mz;
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, tx, yBase + 0.4, tz);
    batcher.addBox('trim_white', 0.18, 2.5, 0.18, tx, yBase + 1.3, tz);
    batcher.addBox(roofColor, 3.2, 0.42, 3.2, tx, yBase + 2.6, tz);
    batcher.addBox('trim_white', 0.6, 0.55, 0.6, tx - 1.3, yBase + 0.28, tz);
    batcher.addBox('trim_white', 0.6, 0.55, 0.6, tx + 1.3, yBase + 0.28, tz);
  }

  if (world.destructibles) {
    for (let c = 0; c < 2; c++) {
      const crateX = kx - 5.2 + c * 1.6;
      const crateZ = kz - 5.2;
      const crateMesh = createLegoBrick(1.2, 1.2, 1.2, c === 0 ? LEGO_COLORS.tan : LEGO_COLORS.orange);
      crateMesh.position.set(crateX, yBase + 0.6, crateZ);
      world.scene.add(crateMesh);
      const col = world.addCollider(crateX, crateZ, 1.2, 1.2, yBase + 1.2, yBase);
      world.destructibles.registerDestructible({
        mesh: crateMesh,
        type: 'crate',
        hp: 15,
        radius: 0.9,
        height: 1.2,
        colliders: [col],
        debrisColors: [LEGO_COLORS.tan, LEGO_COLORS.orange, LEGO_COLORS.yellow],
        studDrops: { silver: 3, gold: 3, blue: 0, purple: 0 },
        groundY: yBase
      });
    }
  }

  world.addCollider(kx, kz, 9.2, 9.2, yBase + 4.5, yBase);
  world.mapBuildings.push({
    x: kx,
    z: kz,
    w: 11,
    d: 11,
    height: 5.5,
    color: '#fb923c',
    label
  });
}

/**
 * 4. FAIXA EXTENSA DE AREIA DOURADA (SEPARADA EM 4 PRAIAS PELOS 3 CANAIS DE SANTOS E ESTENDIDA ATÉ X = -1825!)
 */
function buildGoldenBeachAndShorelineLife(world, batcher) {
  const beachSegmentsX = [
    [-1825, SANTOS_CANALS_X[0] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[0] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[1] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[1] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[2] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[2] + CANAL_WIDTH * 0.5, 538]
  ];

  // Constrói os 4 trechos de Areia Dourada separados pelos 3 Canais e terminando na Foz do Rio Urbano (X = 538)!
  for (const [xStart, xEnd] of beachSegmentsX) {
    const segW = xEnd - xStart;
    const segCenterX = (xStart + xEnd) * 0.5;
    const sandSeg = createLegoBrick(segW, 0.28, 258, 0xb89f72, {
      studs: false,
      roughness: 0.74
    });
    sandSeg.position.set(segCenterX, -0.02, 907);
    world.scene.add(sandSeg);
    world.mapBlocks.push({ x: segCenterX, z: 907, w: segW, d: 258, color: '#b89f72' });

    batcher.addBox('sand_wet', segW, 0.22, 18, segCenterX, -0.12, 1044);
    batcher.addBox('surf_foam', segW, 0.14, 3.2, segCenterX, -0.16, 1054);
  }

  const sandY = 0.12;

  // Guarda-Sóis Listrados, Espreguiçadeiras e Toalhas respeitando os 3 Canais, Dunas, Píer e a Foz do Rio Urbano
  const rowsZ = [815, 865, 925, 980];
  for (let r = 0; r < rowsZ.length; r++) {
    const rz = rowsZ[r];
    for (let ux = -1620; ux <= 515; ux += 48) {
      if (Math.abs(ux) < 54 || isInsideSantosCanal(ux, 18)) continue;
      if (ux >= -1560 && ux <= -1060 && rz >= 830 && rz <= 975) continue;
      if (rz === 865 && (Math.abs(ux - 165) < 26 || Math.abs(ux + 210) < 26 || Math.abs(ux - 340) < 26 || Math.abs(ux + 460) < 26)) {
        continue;
      }

      const jitterX = ux + ((r * 17 + ux) % 11) - 5;
      const jitterZ = rz + ((ux * 7) % 9) - 4;
      const localSandY = Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(jitterX, jitterZ) : sandY);
      const uColor = UMBRELLA_KEYS[Math.floor(Math.random() * UMBRELLA_KEYS.length)];
      const towelColor = UMBRELLA_KEYS[Math.floor(Math.random() * UMBRELLA_KEYS.length)];

      batcher.addBox('trim_white', 0.22, 3.1, 0.22, jitterX, localSandY + 1.55, jitterZ);
      batcher.addBox(uColor, 4.4, 0.42, 4.4, jitterX, localSandY + 3.1, jitterZ);
      batcher.addBox('trim_white', 2.8, 0.38, 2.8, jitterX, localSandY + 3.45, jitterZ);
      batcher.addBox(uColor, 1.2, 0.32, 1.2, jitterX, localSandY + 3.75, jitterZ);

      batcher.addBox('trim_white', 1.25, 0.32, 2.4, jitterX - 1.7, localSandY + 0.16, jitterZ + 0.4);
      batcher.addBox('trim_white', 1.25, 0.55, 0.5, jitterX - 1.7, localSandY + 0.38, jitterZ - 0.6);
      batcher.addBox(towelColor, 1.4, 0.06, 2.5, jitterX + 1.7, localSandY + 0.03, jitterZ + 0.5);
    }
  }

  // 2 Postos / Torres de Salva-Vidas (X = -250 e X = +185, longe dos canais!)
  for (const lx of [-250, 185]) {
    buildLifeguardTower(world, batcher, lx, sandY, 905);
  }

  // 4 Redes de Vôlei de Praia entre os canais
  for (const vx of [-460, -210, 165, 340]) {
    buildBeachVolleyballCourt(batcher, vx, sandY, 865);
  }

  // 16 Castelos de Areia de LEGO Quebráveis espalhados pelas 4 faixas de praia!
  const castlePositions = [
    [-440, 955], [-310, 995], [-275, 945], [-210, 1005],
    [-85, 935], [-68, 990], [-58, 845], [-175, 975],
    [62, 975], [75, 845], [95, 990], [145, 935],
    [195, 1005], [305, 945], [355, 995], [420, 955]
  ];
  for (const [cx, cz] of castlePositions) {
    spawnBreakableSandcastle(world, cx, sandY, cz);
  }
}

function buildLifeguardTower(world, batcher, x, yBase, z) {
  for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) {
    batcher.addBox('wood_pier', 0.48, 3.6, 0.48, x + dx, yBase + 1.8, z + dz);
  }
  batcher.addBox('wood_pier', 5.2, 0.28, 0.28, x, yBase + 1.8, z - 2.4);
  batcher.addBox('wood_pier', 5.2, 0.28, 0.28, x, yBase + 1.8, z + 2.4);

  const deckY = yBase + 3.6;
  batcher.addBox('wood_deck', 7.4, 0.35, 7.4, x, deckY + 0.18, z);
  batcher.addBox('trim_white', 7.4, 0.95, 0.22, x, deckY + 0.8, z + 3.6);
  batcher.addBox('trim_white', 0.22, 0.95, 7.4, x - 3.6, deckY + 0.8, z);
  batcher.addBox('trim_white', 0.22, 0.95, 7.4, x + 3.6, deckY + 0.8, z);

  batcher.addBox('trim_white', 4.8, 3.4, 4.8, x, deckY + 2.05, z - 0.4);
  batcher.addBox('umb_red', 5.0, 0.65, 5.0, x, deckY + 1.0, z - 0.4);
  batcher.addBox('glass_cyan', 3.8, 1.3, 5.0, x, deckY + 2.4, z - 0.4);
  batcher.addBox('umb_red', 6.2, 0.55, 6.2, x, deckY + 4.0, z - 0.4);
  batcher.addBox('umb_red', 4.2, 0.55, 4.2, x, deckY + 4.55, z - 0.4);

  const ladderZ = z - 4.2;
  batcher.addBox('wood_deck', 0.22, 4.0, 0.22, x - 0.65, yBase + 2.0, ladderZ);
  batcher.addBox('wood_deck', 0.22, 4.0, 0.22, x + 0.65, yBase + 2.0, ladderZ);
  for (let ry = 0.6; ry <= 3.4; ry += 0.55) {
    batcher.addBox('trim_white', 1.3, 0.14, 0.18, x, yBase + ry, ladderZ);
  }

  batcher.addBox('umb_red', 1.1, 1.1, 0.28, x + 1.8, deckY + 0.85, z + 3.78);
  batcher.addBox('trim_white', 0.5, 0.5, 0.32, x + 1.8, deckY + 0.85, z + 3.8);

  world.addCollider(x, z, 6.4, 6.4, deckY + 4.8, yBase);
  world.mapBuildings.push({
    x,
    z,
    w: 7.4,
    d: 7.4,
    height: 8.5,
    color: '#ef4444',
    label: 'SALVA-VIDAS'
  });
}

function buildBeachVolleyballCourt(batcher, x, yBase, z) {
  const cw = 18.0;
  const cd = 10.0;
  batcher.addBox('umb_blue', cw, 0.06, 0.22, x, yBase + 0.04, z - cd * 0.5);
  batcher.addBox('umb_blue', cw, 0.06, 0.22, x, yBase + 0.04, z + cd * 0.5);
  batcher.addBox('umb_blue', 0.22, 0.06, cd, x - cw * 0.5, yBase + 0.04, z);
  batcher.addBox('umb_blue', 0.22, 0.06, cd, x + cw * 0.5, yBase + 0.04, z);

  batcher.addBox('trim_white', 0.24, 2.8, 0.24, x, yBase + 1.4, z - cd * 0.5 - 0.4);
  batcher.addBox('trim_white', 0.24, 2.8, 0.24, x, yBase + 1.4, z + cd * 0.5 + 0.4);
  batcher.addBox('trim_white', 0.16, 0.22, cd + 0.8, x, yBase + 2.65, z);
  batcher.addBox('umb_yellow', 0.14, 0.16, cd + 0.8, x, yBase + 1.55, z);
  for (let nz = -cd * 0.5; nz <= cd * 0.5; nz += 0.9) {
    batcher.addBox('stone_black', 0.08, 1.1, 0.08, x, yBase + 2.1, z + nz);
  }
}

const SHARED_SANDCASTLE_MAT = new THREE.MeshStandardMaterial({
  color: 0xfacc15,
  roughness: 0.55
});

function spawnBreakableSandcastle(world, x, yBase, z) {
  const geos = [
    makeTranslatedBox(2.4, 0.75, 2.4, 0, 0.38, 0),
    makeTranslatedBox(1.1, 1.55, 1.1, 0, 0.78, 0),
    makeTranslatedBox(0.65, 1.15, 0.65, -1.0, 0.58, -1.0),
    makeTranslatedBox(0.65, 1.15, 0.65, 1.0, 0.58, -1.0),
    makeTranslatedBox(0.65, 1.15, 0.65, -1.0, 0.58, 1.0),
    makeTranslatedBox(0.65, 1.15, 0.65, 1.0, 0.58, 1.0)
  ];
  const mesh = new THREE.Mesh(mergeBufferGeometries(geos), SHARED_SANDCASTLE_MAT);
  mesh.position.set(x, yBase, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.scene.add(mesh);

  const col = world.addCollider(x, z, 2.5, 2.5, yBase + 1.6, yBase);
  if (world.destructibles) {
    const item = world.destructibles.registerDestructible({
      mesh,
      type: 'sandcastle',
      hp: 10,
      radius: 1.5,
      height: 1.6,
      colliders: [col],
      debrisColors: [0xfde047, 0xfacc15, LEGO_COLORS.tan],
      studDrops: { silver: 4, gold: 3, blue: 0, purple: 0 },
      groundY: yBase
    });
    world.beachSandcastles.push(item);
  }
}

/**
 * 5. MEGA PÍER PARQUE DE MADEIRA (540m MAR ADENTRO!), RESTAURANTE 2 ANDARES, FLIPERAMA,
 * CARROSSEL GIRATÓRIO, MONTANHA-RUSSA, TORRE BIG DROP, RODA-GIGANTE COLOSSAL, FAROL & MARINA!
 */
function buildMonumentalPierFerrisWheelAndMarina(world, batcher) {
  const pierX = 0;
  // Passarela Principal do Píer: 96m de largura, de Z = 1040 até Z = 1420 (380m)
  const mainPierZ = 1230;
  const mainPierW = 96;
  const mainPierD = 380;
  // Grande Praça Oceânica na Ponta Funda do Píer: 136m de largura, de Z = 1420 até Z = 1570 (150m) -> Total: 530m mar adentro!
  const endPlazaZ = 1495;
  const endPlazaW = 136;
  const endPlazaD = 150;
  const deckTopY = 1.6;

  // Rampa Larga de Entrada do Píer saindo da Areia (Z = 1020..1042)
  const entryRamp = createLegoBrick(mainPierW - 10, 1.2, 24, LEGO_COLORS.brown, { studStep: 2.5 });
  entryRamp.position.set(pierX, 0.6, 1030);
  world.scene.add(entryRamp);
  world.addCollider(pierX, 1030, mainPierW - 10, 24, 1.2, 0);

  // Tabuleiro Principal (96m x 380m) + Praça Oceânica Final (136m x 150m)
  const pierDeck = createLegoBrick(mainPierW, 1.6, mainPierD, LEGO_COLORS.brown, { studStep: 8.0 });
  pierDeck.position.set(pierX, deckTopY * 0.5, mainPierZ);
  world.scene.add(pierDeck);
  world.addCollider(pierX, mainPierZ, mainPierW, mainPierD, deckTopY, 0);
  world.mapBlocks.push({ x: pierX, z: mainPierZ, w: mainPierW, d: mainPierD, color: '#92400e' });

  const plazaDeck = createLegoBrick(endPlazaW, 1.6, endPlazaD, LEGO_COLORS.brown, { studStep: 8.0 });
  plazaDeck.position.set(pierX, deckTopY * 0.5, endPlazaZ);
  world.scene.add(plazaDeck);
  world.addCollider(pierX, endPlazaZ, endPlazaW, endPlazaD, deckTopY, 0);
  world.mapBlocks.push({ x: pierX, z: endPlazaZ, w: endPlazaW, d: endPlazaD, color: '#78350f' });

  // Mais de 140 Estacas / Pilares de Madeira com Travessas fincados no Oceano sob todo o Mega Píer!
  for (let pz = 1048; pz <= 1564; pz += 22) {
    const halfW = pz >= 1420 ? endPlazaW * 0.5 - 4 : mainPierW * 0.5 - 4;
    for (const px of [-halfW, -halfW * 0.5, 0, halfW * 0.5, halfW]) {
      batcher.addBox('wood_pilings', 1.6, 3.4, 1.6, px, -0.2, pz);
    }
    batcher.addBox('wood_pilings', halfW * 2, 0.45, 0.45, 0, -0.1, pz);
  }

  // Cercas Laterais Brancas de Segurança + Postes Duplos Estilo Parque Temático ao longo dos 530m
  batcher.addBox('trim_white', 0.5, 1.2, mainPierD, -mainPierW * 0.5 + 0.6, deckTopY + 0.6, mainPierZ);
  batcher.addBox('trim_white', 0.5, 1.2, mainPierD, mainPierW * 0.5 - 0.6, deckTopY + 0.6, mainPierZ);
  batcher.addBox('trim_white', 0.5, 1.2, endPlazaD, -endPlazaW * 0.5 + 0.6, deckTopY + 0.6, endPlazaZ);
  batcher.addBox('trim_white', 0.5, 1.2, endPlazaD, endPlazaW * 0.5 - 0.6, deckTopY + 0.6, endPlazaZ);
  batcher.addBox('trim_white', endPlazaW, 1.2, 0.5, pierX, deckTopY + 0.6, 1569.4);

  for (let lz = 1055; lz <= 1555; lz += 25) {
    const railX = lz >= 1420 ? endPlazaW * 0.5 - 3.5 : mainPierW * 0.5 - 3.5;
    for (const lx of [-railX, railX]) {
      batcher.addBox('stone_black', 0.4, 5.2, 0.4, lx, deckTopY + 2.6, lz);
      batcher.addBox('window_warm', 1.1, 1.1, 1.1, lx, deckTopY + 5.4, lz);
    }
  }

  // 1. PÓRTICO MONUMENTAL DE ENTRADA DO PÍER + BILHETERIAS (Z = 1046)
  batcher.addBox('trim_white', 3.2, 14.5, 3.2, -26, deckTopY + 7.25, 1046);
  batcher.addBox('trim_white', 3.2, 14.5, 3.2, 26, deckTopY + 7.25, 1046);
  batcher.addBox('neon_pink', 56.0, 3.2, 1.8, 0, deckTopY + 14.8, 1046);
  addNeonHotelSign(world, 0, deckTopY + 15.2, 1044.5, 48, 'PÍER PARQUE ATLÂNTICO ', '#00f0ff', '#fde047');

  // 2. RESTAURANTE MARÍTIMO DE 2 ANDARES COM TERRAÇO PANORÂMICO (X = -28, Z = 1125)
  const restX = -28;
  const restZ = 1125;
  batcher.addBox('coastal_white', 24, 1.4, 34, restX, deckTopY + 0.7, restZ);
  batcher.addBox('glass_cyan', 22.8, 3.6, 32.8, restX, deckTopY + 3.2, restZ);
  batcher.addBox('wood_deck', 26, 0.7, 36, restX, deckTopY + 5.35, restZ);
  batcher.addBox('coastal_turquoise', 16, 4.4, 20, restX - 3, deckTopY + 7.9, restZ - 4);
  batcher.addBox('umb_orange', 18, 0.9, 22, restX - 3, deckTopY + 10.55, restZ - 4);
  for (const tz of [restZ + 8, restZ + 14]) {
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, restX + 5, deckTopY + 6.1, tz);
    batcher.addBox('umb_red', 3.2, 0.4, 3.2, restX + 5, deckTopY + 8.1, tz);
  }
  addNeonHotelSign(world, restX + 12.5, deckTopY + 8.5, restZ, 24, 'RESTAURANTE DO PÍER', '#fb923c', '#ffffff');
  world.addCollider(restX, restZ, 25, 35, deckTopY + 10.5, deckTopY);

  // 3. FLIPERAMA / ARCADE NEON 3D (X = +28, Z = 1125) — camadas verticais sem z-fighting!
  const arcX = 28;
  const arcZ = 1125;
  batcher.addBox('window_warm', 22, 3.6, 32, arcX, deckTopY + 1.8, arcZ);
  batcher.addBox('neon_pink', 25, 0.9, 35, arcX, deckTopY + 4.05, arcZ);
  batcher.addBox('stone_black', 24, 3.7, 34, arcX, deckTopY + 6.35, arcZ);
  batcher.addBox('neon_cyan', 25.4, 0.9, 35.4, arcX, deckTopY + 8.65, arcZ);
  addNeonHotelSign(world, arcX - 12.5, deckTopY + 7.2, arcZ, 24, 'MEGA ARCADE LEGO ', '#ec4899', '#00f0ff');
  world.addCollider(arcX, arcZ, 25, 35, deckTopY + 9.2, deckTopY);

  // 4. OITO BARRAQUINHAS TEMÁTICAS COLORIDAS (Sorveteria com Casquinha Gigante, Pipoca, Churros, Tiro ao Alvo)
  const boothZList = [1185, 1225, 1265, 1385];
  boothZList.forEach((bz, bIdx) => {
    for (const side of [-1, 1]) {
      const bx = side * 32.0;
      const bColor = UMBRELLA_KEYS[(bIdx * 2 + (side > 0 ? 1 : 0)) % UMBRELLA_KEYS.length];
      batcher.addBox('trim_white', 9.5, 4.2, 9.5, bx, deckTopY + 2.1, bz);
      batcher.addBox(bColor, 10.8, 0.95, 10.8, bx, deckTopY + 4.6, bz);
      batcher.addBox('trim_white', 7.8, 0.85, 7.8, bx, deckTopY + 5.4, bz);
      batcher.addBox('window_warm', 7.2, 1.6, 9.7, bx, deckTopY + 2.5, bz);
      // Sorvete / Casquinha 3D gigante decorativa no topo das primeiras barraquinhas!
      if (bIdx % 2 === 0) {
        batcher.addBox('wood_deck', 1.6, 2.2, 1.6, bx, deckTopY + 6.8, bz);
        batcher.addBox('umb_pink', 2.6, 2.2, 2.6, bx, deckTopY + 8.6, bz);
        batcher.addBox('trim_white', 1.8, 1.4, 1.8, bx, deckTopY + 10.1, bz);
      }
      world.addCollider(bx, bz, 9.6, 9.6, deckTopY + 5.6, deckTopY);
    }
  });

  // 5. MONTANHA-RUSSA OCEÂNICA EM CIRCUITO FECHADO (Construída dinamicamente em `InteractiveAttractionsAndEmotes.js`!)

  // 6. CARROSSEL CLÁSSICO GIRATÓRIO 3D (X = -16, Z = 1325) — Gira continuamente no loop!
  const carouselGroup = new THREE.Group();
  carouselGroup.position.set(-16, deckTopY, 1325);
  const cBase = createLegoBrick(18, 0.8, 18, LEGO_COLORS.white);
  cBase.position.y = 0.4;
  const cPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 8.5, 16),
    getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.2 })
  );
  cPillar.position.y = 4.6;
  const cRoof1 = new THREE.Mesh(
    new THREE.ConeGeometry(11.5, 4.5, 16),
    getLegoMaterial(0xec4899, { roughness: 0.25 })
  );
  cRoof1.position.y = 10.2;
  carouselGroup.add(cBase, cPillar, cRoof1);

  for (let h = 0; h < 8; h++) {
    const ang = (h / 8) * Math.PI * 2;
    const hx = Math.cos(ang) * 6.8;
    const hz = Math.sin(ang) * 6.8;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 7.5, 8),
      getLegoMaterial(LEGO_COLORS.gold)
    );
    pole.position.set(hx, 4.4, hz);
    const mount = createLegoBrick(1.4, 1.2, 2.4, h % 2 === 0 ? LEGO_COLORS.white : 0x38bdf8);
    mount.position.set(hx, 2.2 + (h % 2) * 0.8, hz);
    mount.rotation.y = -ang;
    carouselGroup.add(pole, mount);
  }
  world.scene.add(carouselGroup);
  world.rotatingElements.push({ mesh: carouselGroup, axis: 'y', speed: 0.85 });
  world.addCollider(-16, 1325, 18, 18, deckTopY + 12, deckTopY);

  // 7. TORRE DE QUEDA LIVRE "BIG DROP" DE 58m DE ALTURA! (X = +24, Z = 1325 — Gôndola animada em `InteractiveAttractionsAndEmotes.js`!)
  const dropX = 24;
  const dropZ = 1325;
  const dropH = 58.0;
  batcher.addBox('umb_red', 5.2, dropH, 5.2, dropX, deckTopY + dropH * 0.5, dropZ);
  batcher.addBox('umb_yellow', 6.4, 3.2, 6.4, dropX, deckTopY + dropH, dropZ);
  batcher.addBox('neon_cyan', 7.8, 1.8, 7.8, dropX, deckTopY + dropH + 2.2, dropZ);
  world.addCollider(dropX, dropZ, 5.4, 5.4, deckTopY + dropH + 3.0, deckTopY);

  // ============================================================================
  // 8. RODA-GIGANTE 3D COLOSSAL NA PRAÇA FUNDA DO PÍER (Z = 1480, Raio 32m, 16 Cabines!)
  // ============================================================================
  const wheelZ = 1480;
  const wheelCenterY = 42.0;
  const wheelRadius = 31.0;
  const cabinCount = 16;

  batcher.addBox('trim_white', 34, 2.6, 52, 0, deckTopY + 1.3, wheelZ);
  world.addCollider(0, wheelZ, 34, 52, deckTopY + 2.6, deckTopY);

  const supportMat = getLegoMaterial(LEGO_COLORS.white);
  const neonHubMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

  for (const sx of [-7.5, 7.5]) {
    const legA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 45, 2.6), supportMat);
    legA.position.set(sx, 23.0, wheelZ - 11.0);
    legA.rotation.x = -0.24;
    const legB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 45, 2.6), supportMat);
    legB.position.set(sx, 23.0, wheelZ + 11.0);
    legB.rotation.x = 0.24;
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 2.6, 20), neonPinkMat);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.set(sx, wheelCenterY, wheelZ);
    world.scene.add(legA, legB, hubCap);
  }

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, wheelCenterY, wheelZ);

  const rimMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.2 });
  const innerNeonMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  for (const rx of [-3.8, 3.8]) {
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.85, 12, 48), rimMat);
    outerRing.rotation.y = Math.PI / 2;
    outerRing.position.x = rx;
    wheelGroup.add(outerRing);

    const neonRing = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius * 0.72, 0.45, 10, 40), neonHubMat);
    neonRing.rotation.y = Math.PI / 2;
    neonRing.position.x = rx * 0.92;
    wheelGroup.add(neonRing);
  }

  const centerAxle = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 16.0, 20), innerNeonMat);
  centerAxle.rotation.z = Math.PI / 2;
  wheelGroup.add(centerAxle);

  const cabinColors = [
    LEGO_COLORS.red,
    LEGO_COLORS.blue,
    LEGO_COLORS.yellow,
    LEGO_COLORS.orange,
    LEGO_COLORS.green,
    0xec4899,
    0x06b6d4,
    0xa855f7
  ];

  const ferrisCabins = [];
  for (let i = 0; i < cabinCount; i++) {
    const angle = (i / cabinCount) * Math.PI * 2;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    for (const rx of [-3.6, 3.6]) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, wheelRadius * 2, 8), rimMat);
      spoke.position.x = rx;
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    const cabinColor = cabinColors[i % cabinColors.length];
    const cabinGroup = new THREE.Group();
    const cabinBody = createLegoBrick(5.0, 2.0, 4.0, cabinColor, { studs: false });
    cabinBody.position.y = -1.0;
    const cabinGlass = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.3, 3.8),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45 })
    );
    cabinGlass.position.y = 0.45;
    const cabinRoof = createLegoBrick(5.2, 0.6, 4.2, cabinColor);
    cabinRoof.position.y = 1.35;

    cabinGroup.add(cabinBody, cabinGlass, cabinRoof);
    cabinGroup.position.set(0, sinA * wheelRadius, cosA * wheelRadius);
    wheelGroup.add(cabinGroup);
    ferrisCabins.push(cabinGroup);
  }

  world.scene.add(wheelGroup);
  world.ferrisWheelGroup = wheelGroup;
  world.ferrisWheelCabins = ferrisCabins;
  world.ferrisWheelCabinCount = cabinCount;
  world.pierData = { zStart: 1030, zEnd: 1570, length: 540, width: mainPierW, plazaWidth: endPlazaW };

  // 9. FAROL MARÍTIMO LISTRADO VERMELHO E BRANCO NA PONTA FINAL DO PÍER (Z = 1552, 36m de altura!)
  const lhZ = 1552;
  for (let s = 0; s < 6; s++) {
    const segW = 8.4 - s * 0.7;
    const segColor = s % 2 === 0 ? 'umb_red' : 'trim_white';
    batcher.addBox(segColor, segW, 5.2, segW, 0, deckTopY + s * 5.2 + 2.6, lhZ);
  }
  const lanternY = deckTopY + 31.2;
  batcher.addBox('stone_black', 6.5, 0.8, 6.5, 0, lanternY + 0.4, lhZ);
  batcher.addBox('window_warm', 4.6, 3.6, 4.6, 0, lanternY + 2.6, lhZ);
  batcher.addBox('umb_red', 5.8, 2.2, 5.8, 0, lanternY + 5.2, lhZ);
  world.addCollider(0, lhZ, 8.5, 8.5, lanternY + 6.5, deckTopY);

  // ============================================================================
  // 10. MARINA / RAMPA NÁUTICA AMPLIADA COM LANCHAS & JET-SKIS LEGO (X = +48..+150)
  // ============================================================================
  const marinaX = 102;
  const marinaZ = 1145;

  batcher.addBox('wood_deck', 58, 0.6, 14, 72, 0.45, 1085);
  batcher.addBox('wood_deck', 12, 0.55, 165, marinaX, 0.15, marinaZ);
  world.addCollider(marinaX, marinaZ, 12, 165, 0.8, 0);
  world.mapBlocks.push({ x: marinaX, z: marinaZ, w: 85, d: 165, color: '#b45309' });

  const dockZList = [1095, 1135, 1175, 1215];

  dockZList.forEach((dz) => {
    batcher.addBox('wood_deck', 46, 0.45, 5.8, marinaX + 26, 0.1, dz);
    batcher.addBox('trim_white', 0.48, 0.9, 0.48, marinaX + 14, 0.55, dz - 2.3);
    batcher.addBox('trim_white', 0.48, 0.9, 0.48, marinaX + 38, 0.55, dz - 2.3);
    // As Lanchas e Jet-Skis da Marina agora são veículos pilotáveis reais (em NavalAndAirFleetBuilder.js)!
  });
}

function addLegoSpeedboat(batcher, x, yWater, z, hullKey) {
  batcher.addBox('trim_white', 3.4, 0.85, 8.8, x, yWater + 0.3, z);
  batcher.addBox(hullKey, 3.55, 0.38, 8.9, x, yWater + 0.52, z);
  batcher.addBox('trim_white', 2.4, 0.75, 2.4, x, yWater + 0.35, z + 5.2);
  batcher.addBox('glass_cyan', 2.9, 0.75, 1.4, x, yWater + 0.98, z + 1.4);
  batcher.addBox('trim_white', 2.4, 0.65, 1.2, x, yWater + 0.82, z - 0.6);
  batcher.addBox('stone_black', 1.1, 1.1, 1.1, x, yWater + 0.65, z - 4.6);
  batcher.addBox('surf_foam', 4.2, 0.08, 10.6, x, yWater - 0.16, z - 0.6);
}

/**
 * 6. PONTA DA PRAIA / COSTÃO SUDOESTE (X = -1825..-1010, Z = 790..1230):
 * - Farol Marítimo Vermelho e Branco de LEGO sobre rochas costeiras (X = -1735, Z = 945, 64m de altura!)
 * - Dunas de Areia Dourada com Coqueiros e Pista de Buggies (X = -1540..-1080, Z = 835..965)
 * - Marina Oeste com Píer de Madeira, 4 Docas Laterais e Clube Náutico (X = -1380, Z = 1045..1230)
 */
function buildSouthwestPointLighthouseDunesAndWestMarina(world, batcher) {
  // 1. COSTÃO ROCHOSO SUDOESTE & FAROL MARÍTIMO VERMELHO E BRANCO DE LEGO (X = -1735, Z = 945)
  const lhX = -1735;
  const lhZ = 945;

  // Promontório de rochas costeiras escuras escalonadas na Ponta Sudoeste (X = -1815..-1655, Z = 865..1040)
  batcher.addBox('stone_black', 150, 4.2, 160, lhX, 2.1, lhZ);
  batcher.addBox('stone_grey', 112, 7.6, 120, lhX, 5.8, lhZ);
  batcher.addBox('stone_black', 76, 10.8, 82, lhX, 9.6, lhZ);
  world.addCollider(lhX, lhZ, 76, 82, 15.0, 0);
  world.mapBlocks.push({ x: lhX, z: lhZ, w: 150, d: 160, color: '#334155' });

  // Rochedos quebra-mar ao redor do promontório na água
  const rockOffsets = [
    [-75, 45, 22, 6.5, 20],
    [-68, -35, 18, 5.2, 18],
    [68, 50, 24, 6.0, 22],
    [0, 78, 28, 5.8, 18],
    [-42, 76, 20, 4.8, 16]
  ];
  for (const [rx, rz, rw, rh, rd] of rockOffsets) {
    batcher.addBox('stone_black', rw, rh, rd, lhX + rx, rh * 0.5 - 0.2, lhZ + rz);
    batcher.addBox('surf_foam', rw + 5, 0.16, rd + 5, lhX + rx, 0.05, lhZ + rz);
  }

  // Torre do Farol Marítimo Vermelho e Branco de LEGO (8 anéis escalonados = 52m + base de 15m = 67m de altura!)
  const baseTopY = 15.0;
  for (let s = 0; s < 8; s++) {
    const segW = 16.0 - s * 1.15;
    const segH = 6.0;
    const segColor = s % 2 === 0 ? 'umb_red' : 'trim_white';
    batcher.addBox(segColor, segW, segH, segW, lhX, baseTopY + s * segH + segH * 0.5, lhZ);
  }
  const lanternBaseY = baseTopY + 48.0;
  batcher.addBox('stone_black', 11.2, 1.2, 11.2, lhX, lanternBaseY + 0.6, lhZ);
  batcher.addBox('window_warm', 7.8, 5.4, 7.8, lhX, lanternBaseY + 3.9, lhZ);
  batcher.addBox('umb_red', 9.8, 2.8, 9.8, lhX, lanternBaseY + 8.0, lhZ);
  batcher.addBox('umb_red', 5.2, 2.4, 5.2, lhX, lanternBaseY + 10.6, lhZ);
  world.addCollider(lhX, lhZ, 16, 16, lanternBaseY + 12.0, baseTopY);

  // Casa do Faroleiro & Mirante Oeste ao lado do Farol
  batcher.addBox('coastal_white', 22, 7.5, 16, lhX + 22, baseTopY + 3.75, lhZ - 8);
  batcher.addBox('umb_red', 24, 1.8, 18, lhX + 22, baseTopY + 8.4, lhZ - 8);
  addNeonHotelSign(world, lhX, lanternBaseY + 9.2, lhZ + 5.4, 16, 'FAROL SUDOESTE', '#ef4444', '#ffffff');

  world.mapBuildings.push({
    x: lhX,
    z: lhZ,
    w: 26,
    d: 26,
    height: 67,
    color: '#ef4444',
    isLandmark: true,
    label: 'FAROL COSTÃO OESTE'
  });

  // 2. DUNAS DE AREIA DOURADA COM COQUEIROS & PISTA DE BUGGY (X = -1540..-1080, Z = 835..965)
  const duneClusters = [
    { x: -1510, z: 875, w: 96, d: 58, h: 4.8 },
    { x: -1395, z: 915, w: 112, d: 64, h: 6.2 },
    { x: -1275, z: 868, w: 104, d: 56, h: 5.4 },
    { x: -1155, z: 908, w: 98, d: 62, h: 4.6 }
  ];
  for (const d of duneClusters) {
    batcher.addBox('coastal_sun', d.w, d.h * 0.45, d.d, d.x, d.h * 0.22, d.z);
    batcher.addBox('sand_wet', d.w * 0.68, d.h * 0.4, d.d * 0.68, d.x, d.h * 0.62, d.z);
    batcher.addBox('coastal_sun', d.w * 0.38, d.h * 0.32, d.d * 0.38, d.x, d.h * 0.92, d.z);
    addCurvedLegoPalmTree(batcher, d.x - d.w * 0.22, d.h * 0.65, d.z - 6, -0.22, 0.85, 1.15);
    addCurvedLegoPalmTree(batcher, d.x + d.w * 0.22, d.h * 0.65, d.z + 6, 0.24, 0.82, 1.1);
  }

  // 3. MARINA OESTE COM PÍER DE MADEIRA, CLUBE NÁUTICO & 4 DOCAS DE LANCHAS (X = -1380, Z = 1045..1230)
  const westMarinaX = -1380;
  const westMarinaZ = 1135;

  // Clube Náutico Oeste na entrada da Marina (Z = 1032)
  batcher.addBox('wood_deck', 56, 0.8, 26, westMarinaX, 0.4, 1032);
  batcher.addBox('coastal_white', 38, 1.6, 16, westMarinaX, 1.6, 1030);
  batcher.addBox('glass_cyan', 34, 4.4, 14.8, westMarinaX, 4.6, 1030);
  batcher.addBox('coastal_turquoise', 42, 1.2, 19, westMarinaX, 7.4, 1030);
  addNeonHotelSign(world, westMarinaX, 9.2, 1020.5, 32, 'MARINA OESTE ', '#06b6d4', '#fde047');
  world.addCollider(westMarinaX, 1030, 38, 16, 8.5, 0);
  world.mapBuildings.push({
    x: westMarinaX,
    z: 1030,
    w: 42,
    d: 19,
    height: 9,
    color: '#06b6d4',
    label: 'MARINA OESTE'
  });

  // Passarela Principal da Marina Oeste (14m x 185m avançando no mar até Z = 1225)
  batcher.addBox('wood_deck', 14, 0.65, 185, westMarinaX, 0.25, westMarinaZ);
  world.addCollider(westMarinaX, westMarinaZ, 14, 185, 0.9, 0);
  world.mapBlocks.push({ x: westMarinaX, z: westMarinaZ, w: 92, d: 185, color: '#b45309' });

  const westDockZList = [1095, 1135, 1175, 1215];
  westDockZList.forEach((dz) => {
    batcher.addBox('wood_deck', 48, 0.48, 6.0, westMarinaX + 28, 0.15, dz);
    batcher.addBox('trim_white', 0.5, 0.95, 0.5, westMarinaX + 14, 0.6, dz - 2.4);
    batcher.addBox('trim_white', 0.5, 0.95, 0.5, westMarinaX + 42, 0.6, dz - 2.4);
  });

  world.southwestBeachData = {
    hasSouthwestLighthouse: true,
    lighthousePos: { x: lhX, y: baseTopY, z: lhZ, height: 67 },
    hasSandDunes: true,
    dunesCount: duneClusters.length,
    hasWestMarina: true,
    westMarinaPos: { x: westMarinaX, z: westMarinaZ, docksCount: westDockZList.length }
  };
}
