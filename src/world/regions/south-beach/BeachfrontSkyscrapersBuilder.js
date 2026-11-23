import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  configureCrispCanvasTexture,
  markAsSharedAsset
} from '../../../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  mergeColoredGeometries,
  makeTranslatedBox
} from '../../BuildingGenerator.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
import {
  TROPICAL_WALL_KEYS,
  addCurvedLegoPalmTree,
  addNeonHotelSign
} from './BeachBatcherAndConstants.js';
import { buildCoastalOrganicBlocksAndBoulevards } from './CoastalOrganicBlocksFiller.js';

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

const BEACH_THEME_FAMILY_MAP = {
  azure_balcony: 'azure_balcony',
  aqua_wave: 'azure_balcony',
  sapphire_curtain: 'sapphire_curtain',
  retail_arcade: 'sapphire_curtain',
  gold_imperial: 'gold_imperial',
  sand_terrace: 'gold_imperial',
  coral_resort: 'coral_resort',
  aurora_deco: 'coral_resort'
};

const _BEACH_FACADE_CACHE = new Map();
let _SHARED_BEACH_SOLID_VC_MAT = null;
let _SHARED_BEACH_BASIC_VC_MAT = null;

function _getSharedBeachSolidVcMat() {
  if (!_SHARED_BEACH_SOLID_VC_MAT) {
    _SHARED_BEACH_SOLID_VC_MAT = markAsSharedAsset(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.12
      })
    );
  }
  return _SHARED_BEACH_SOLID_VC_MAT;
}

function _getSharedBeachBasicVcMat() {
  if (!_SHARED_BEACH_BASIC_VC_MAT) {
    _SHARED_BEACH_BASIC_VC_MAT = markAsSharedAsset(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true
      })
    );
  }
  return _SHARED_BEACH_BASIC_VC_MAT;
}

function _getBeachFacadeMaterial(themeKey = 'azure_balcony', _variant = 0) {
  const familyKey = BEACH_THEME_FAMILY_MAP[themeKey] || 'azure_balcony';
  if (_BEACH_FACADE_CACHE.has(familyKey)) return _BEACH_FACADE_CACHE.get(familyKey);

  const th = BEACH_FACADE_THEMES[familyKey] || BEACH_FACADE_THEMES.azure_balcony;
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

    const floors = 12;
    const cols = 6;
    const rowH = 512 / floors;
    const colW = 256 / cols;

    for (let r = 0; r < floors; r++) {
      const y = r * rowH;
      ctx.fillStyle = th.slab;
      ctx.fillRect(0, y, 256, Math.max(8, rowH * 0.26));

      for (let c = 0; c < cols; c++) {
        const x = c * colW;
        const padX = Math.max(4, colW * 0.12);
        const winW = colW - padX * 2;
        const winY = y + rowH * 0.28;
        const winH = rowH * 0.66;

        ctx.fillStyle = th.glass;
        ctx.fillRect(x + padX, winY, winW, winH);
        ctx.fillStyle = th.glassHi;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x + padX + 2, winY + 2, winW * 0.42, winH - 4);
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = th.slab;
        ctx.globalAlpha = 0.42;
        ctx.fillRect(x + padX, winY + winH * 0.58, winW, 4);
        ctx.globalAlpha = 1.0;

        const hash = ((r * 23 + c * 41 + familyKey.length * 7) * 2654435761) >>> 0;
        if (hash % 10 < 5) {
          nctx.fillStyle = (hash % 7 === 0) ? th.glow : th.warmWin;
          nctx.fillRect(x + padX + 2, winY + 3, winW - 4, winH - 6);
        }
      }
    }
  }

  const dayTex = markAsSharedAsset(configureCrispCanvasTexture(new THREE.CanvasTexture(dayCanvas), 8));
  dayTex.wrapS = THREE.RepeatWrapping;
  dayTex.wrapT = THREE.RepeatWrapping;

  const nightTex = markAsSharedAsset(configureCrispCanvasTexture(new THREE.CanvasTexture(nightCanvas), 8));
  nightTex.wrapS = THREE.RepeatWrapping;
  nightTex.wrapT = THREE.RepeatWrapping;

  const mat = markAsSharedAsset(
    new THREE.MeshStandardMaterial({
      map: dayTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: nightTex,
      emissiveIntensity: 0.0,
      roughness: th.rough,
      metalness: th.metal
    })
  );
  mat.userData.isDynamicMaterial = true;

  _BEACH_FACADE_CACHE.set(familyKey, mat);
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
export class BeachTowerBuilder {
  constructor() {
    this.lodFacades = [new Map(), new Map(), new Map()];
    this.lodSolids = [[], [], []];
    this.lodBasics = [[], [], []];
  }

  addSolid(lodIdx, _key, hex, w, h, d, lx, ly, lz, opts = {}) {
    const entry = {
      geo: makeTranslatedBox(w, h, d, lx, ly, lz),
      color: new THREE.Color(hex)
    };
    if (opts.basic) {
      this.lodBasics[lodIdx].push(entry);
    } else {
      this.lodSolids[lodIdx].push(entry);
    }
  }

  addFacade(lodIdx, themeKey, variant, w, h, d, lx, ly, lz, tileW = 24, tileH = 44) {
    const mat = _getBeachFacadeMaterial(themeKey, variant);
    const map = this.lodFacades[lodIdx];
    let geos = map.get(mat);
    if (!geos) {
      geos = [];
      map.set(mat, geos);
    }
    geos.push(_makeUvScaledBox(w, h, d, lx, ly, lz, tileW, tileH));
  }

  buildLOD(worldX, worldY, worldZ) {
    const lod = new THREE.LOD();
    lod.position.set(worldX, worldY, worldZ);
    const distances = [0, 320, 1020];
    const solidVcMat = _getSharedBeachSolidVcMat();
    const basicVcMat = _getSharedBeachBasicVcMat();

    for (let li = 0; li < 3; li++) {
      const grp = new THREE.Group();
      for (const [mat, geos] of this.lodFacades[li].entries()) {
        if (!geos.length) continue;
        const m = new THREE.Mesh(mergeBufferGeometries(geos), mat);
        m.castShadow = li === 0;
        m.receiveShadow = li < 2;
        grp.add(m);
      }
      if (this.lodSolids[li].length > 0) {
        const sm = new THREE.Mesh(mergeColoredGeometries(this.lodSolids[li]), solidVcMat);
        sm.castShadow = li === 0;
        sm.receiveShadow = li < 2;
        grp.add(sm);
      }
      if (this.lodBasics[li].length > 0) {
        const bm = new THREE.Mesh(mergeColoredGeometries(this.lodBasics[li]), basicVcMat);
        bm.castShadow = false;
        bm.receiveShadow = false;
        grp.add(bm);
      }
      lod.addLevel(grp, distances[li]);
    }
    return lod;
  }
}

export function registerBeachEmissiveMaterials(world) {
  for (const k of ['azure_balcony', 'sapphire_curtain', 'gold_imperial', 'coral_resort']) {
    _getBeachFacadeMaterial(k, 0);
  }
  for (const mat of _BEACH_FACADE_CACHE.values()) {
    if (!world.southBeachEmissiveMats.includes(mat)) {
      world.southBeachEmissiveMats.push(mat);
    }
  }
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

export function buildCoastalHotelBlocks(world, batcher) {
  const hotelColsDesignX = [-582, -450, -318, -186, -60, 60, 186, 318, 450];
  const bd = 96;
  const innerD = bd - 10; // 86m (sempre 1x!)
  const halfD = innerD * 0.5;
  const frontRowZ = IS_SCALED_WORLD
    ? ws(710) - (ROAD.mainWidth * 0.5 + ROAD.sidewalk + halfD + 1.5)
    : 630;
  const quadraMarZ = IS_SCALED_WORLD
    ? ws(556) - (ROAD.secondaryWidth * 0.5 + ROAD.sidewalk + halfD + 4.0)
    : 480;

  // 1.1 Fileira Traseira "Quadra Mar": 18 Torres Residenciais Costeiras (38 a 52 andares, tamanho 1x!)
  hotelColsDesignX.forEach((dhx, idx) => {
    const bw = Math.abs(dhx) === 60 ? 92 : 104;
    const innerW = bw - 10;
    const hx = ws(dhx);
    if (!IS_SCALED_WORLD) {
      world._addCityBlockSidewalk(hx, quadraMarZ, bw, bd, LEGO_COLORS.sidewalk);
    }

    const lotW = (innerW - 6) * 0.5;
    const pairGap = IS_SCALED_WORLD ? 24 : 6;
    const floors1 = 38 + (idx % 4) * 4;
    const floors2 = 42 + ((idx + 2) % 4) * 3;
    buildGenericHighRiseResort(world, batcher, hx - (lotW + pairGap) * 0.5, quadraMarZ, lotW, innerD, floors1, idx * 2, false);
    buildGenericHighRiseResort(world, batcher, hx + (lotW + pairGap) * 0.5, quadraMarZ, lotW, innerD, floors2, idx * 2 + 1, false);
  });

  // 1.2 Orla Oeste (X = ws(-955)..ws(-582)): Torres Costeiras Remodeladas (tamanho 1x, ancoradas na Av. Beira-Mar!)
  for (const [designEdgeX, seedIdx, bwEdge, floorsLeft, floorsRight, labelText] of [
    [-955, 2, 114, 46, 50, 'RESORT PONTA OESTE'],
    [-832, 4, 114, 48, 54, 'MIRANTE CAMBORIÚ TOWER'],
    [-710, 6, 114, 52, 56, 'COSTA ESMERALDA TWIN'],
    [-582, 0, 104, 50, 55, 'ATLÂNTICO SUL RESIDENCE']
  ]) {
    const edgeX = ws(designEdgeX);
    if (!IS_SCALED_WORLD) {
      world._addCityBlockSidewalk(edgeX, frontRowZ, bwEdge, 96, LEGO_COLORS.sidewalk);
    } else if (designEdgeX < -648) {
      world._addCityBlockSidewalk(edgeX, frontRowZ, bwEdge + 24, innerD + 2, LEGO_COLORS.sidewalk);
    }
    const innerW = bwEdge - 10;
    const lotW = (innerW - 6) * 0.5;
    const pairGap = IS_SCALED_WORLD ? 20 : 6;
    buildGenericHighRiseResort(
      world,
      batcher,
      edgeX - (lotW + pairGap) * 0.5,
      frontRowZ,
      lotW,
      innerD,
      floorsLeft,
      seedIdx,
      true,
      labelText
    );
    buildGenericHighRiseResort(
      world,
      batcher,
      edgeX + (lotW + pairGap) * 0.5,
      frontRowZ,
      lotW,
      innerD,
      floorsRight,
      seedIdx + 1,
      true,
      null
    );
  }

  // Parque Linear & Estacionamento Costeiro Oeste
  const parkX = ws(-1420);
  const parkW = ws(810);
  const parkZ = IS_SCALED_WORLD ? ws(710) - ROAD.mainWidth * 0.5 - 26 : 690;
  const parkTurfZ = IS_SCALED_WORLD ? parkZ - 5 : 682;
  world._addCityBlockSidewalk(parkX, parkZ, parkW, 52, LEGO_COLORS.sidewalk);
  batcher.addBox('palm_leaf', ws(796), 0.22, 24, parkX, 0.35, parkTurfZ);
  const westPalmStep = IS_SCALED_WORLD ? 110 : 46;
  for (let px = ws(-1790); px <= ws(-1040); px += westPalmStep) {
    const py = (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, parkTurfZ) : 0) + (IS_SCALED_WORLD ? 0.16 : 0.32);
    addCurvedLegoPalmTree(batcher, px, py, parkTurfZ, 0.16, 0.85, 1.15);
  }

  // 1.3 OS 8 SUPER-ARRANHA-CÉUS EXCLUSIVOS DA ORLA REMODELADOS (232m a 296m em escala 1x, ancorados fora da Av. Z=ws(710)!)
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
    const sx = ws(spec.x);
    const bz = frontRowZ;
    const w = spec.bw - 10;
    const d = innerD;
    if (!IS_SCALED_WORLD) {
      world._addCityBlockSidewalk(sx, bz, spec.bw, bd, LEGO_COLORS.sidewalk);
    }

    buildSignatureOceanfrontHotel(world, batcher, sx, bz, w, d, spec);

    const palmZ = IS_SCALED_WORLD ? bz + halfD + 2.5 : 675.5;
    const palmPad = IS_SCALED_WORLD ? 0.04 : 0.3;
    const palmLY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(sx - w * 0.38, palmZ) : 0) + palmPad;
    const palmRY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(sx + w * 0.38, palmZ) : 0) + palmPad;
    addCurvedLegoPalmTree(batcher, sx - w * 0.38, palmLY, palmZ, -0.18, 0.78, 1.15);
    addCurvedLegoPalmTree(batcher, sx + w * 0.38, palmRY, palmZ, 0.18, 0.78, 1.15);
  });

  if (IS_SCALED_WORLD) buildCoastalOrganicBlocksAndBoulevards(world, batcher);
}

function buildGenericHighRiseResort(world, batcher, x, z, w, d, floors, seed, isFrontRow = false, signText = null) {
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = terrainY + (IS_SCALED_WORLD ? 0.04 : 0.3);
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
  const yBase = terrainY + (IS_SCALED_WORLD ? 0.04 : 0.3);
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
