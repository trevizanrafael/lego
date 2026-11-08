import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';

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

/**
 * Acumulador de Geometrias 3D da Orla Sul, 8 Hotéis Gigantes, 3 Canais de Santos, Praia & Super Píer:
 * Mantém 60 FPS cravados fundindo milhares de peças LEGO em ~25 Draw Calls!
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
          emissiveIntensity: opts.emissiveIntensity ?? 0
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
    this._registerMat('bike_red', 0xb91c1c, { roughness: 0.5 });
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
    this._registerMat('sand_wet', 0xeab308, { roughness: 0.55 });
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
    arr.push(makeTranslatedBox(w, h, d, x, y, z));
  }

  flush(scene) {
    for (const [key, geos] of this.buckets.entries()) {
      if (geos.length === 0) continue;
      const merged = mergeBufferGeometries(geos);
      if (!merged) continue;
      const mat = this.materials.get(key);
      const mesh = new THREE.Mesh(merged, mat);
      const isShadowCaster =
        key.startsWith('coastal_') ||
        key.startsWith('umb_') ||
        key === 'palm_trunk' ||
        key === 'palm_leaf' ||
        key === 'wood_pier';
      mesh.castShadow = !mat.isMeshBasicMaterial && isShadowCaster;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

/**
 * Constrói um Coqueiro 3D de LEGO com tronco curvado segmentado, cocos e 8 folhas arqueadas no topo
 */
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
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0.7, -0.7],
    [-0.7, -0.7]
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
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 96;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#090a0d';
  sctx.fillRect(0, 0, 512, 96);
  sctx.strokeStyle = borderColor;
  sctx.lineWidth = 8;
  sctx.strokeRect(4, 4, 504, 88);
  sctx.fillStyle = textColor;
  sctx.font = '900 36px "Chakra Petch", Arial, sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText(text, 256, 60);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(width, 4.8, 0.9),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signBoard.position.set(x, y, z);
  world.scene.add(signBoard);
}

/**
 * 5. SUL — RECONSTRUÇÃO MONUMENTAL:
 * - 8 Hotéis Arranha-Céus Gigantes e Individualizados na Orla (118m a 164m de altura!)
 * - 3 Canais Estilo Santos (Canal 1, Canal 2 e Canal 3) descendo da rua e separando a areia da praia até o mar!
 * - Calçadão de Pedras Portuguesas, Ciclovia, Coqueiros e 4 Quiosques
 * - Mega Píer Parque de 540m avançando fundo no mar com Restaurante 2 Andares, Fliperama, Carrossel Giratório,
 *   Montanha-Russa, Torre Big Drop, Roda-Gigante Colossal de 16 Cabines, Farol Marítimo e Marina!
 */
export function buildSouthBeachAndFerrisWheel(world) {
  const batcher = new SouthBeachBatcher();

  world.southBeachHotels = [];
  world.beachSandcastles = [];
  world.santosCanals = [];

  // 1. OS 8 HOTÉIS GIGANTES E INDIVIDUALIZADOS DA ORLA (118m a 164m!) + SEGUNDA FILEIRA ALTA (Z = 480)
  buildCoastalHotelBlocks(world, batcher);

  // 2. OS 3 CANAIS ESTILO SANTOS (Cortando o Calçadão e separando a Areia da Praia até o Oceano!)
  buildSantosStyleBeachCanals(world, batcher);

  // 3. AVENIDA BEIRA-MAR, CALÇADÃO DE PEDRAS PORTUGUESAS, CICLOVIA, COQUEIROS & 4 QUIOSQUES
  buildOceanfrontBoardwalkAndKiosks(world, batcher);

  // 4. FAIXA EXTENSA DE AREIA DOURADA (DIVIDIDA PELOS 3 CANAIS), GUARDA-SÓIS, SALVA-VIDAS, VÔLEI & CASTELOS
  buildGoldenBeachAndShorelineLife(world, batcher);

  // 5. MEGA PÍER PARQUE DE 540m (MUITO MAIOR E MAIS PRO FUNDO!), ATRAÇÕES, RODA-GIGANTE, FAROL & MARINA
  buildMonumentalPierFerrisWheelAndMarina(world, batcher);

  // 6. PONTA DA PRAIA / COSTÃO SUDOESTE (X = -1825..-634): FAROL MARÍTIMO LEGO, DUNAS DE BUGGY & MARINA OESTE
  buildSouthwestPointLighthouseDunesAndWestMarina(world, batcher);

  batcher.flush(world.scene);
}

/**
 * 1. SKYLINE ESTILO BALNEÁRIO CAMBORIÚ ("DUBAI BRASILEIRA"):
 * - 8 Super-Arranha-Céus Exclusivos de Frente pro Mar (Z = 630, de 232m a 296m de altura / 60 a 78 andares!)
 * - 4 Quarteirões Costeiros Oeste (X = -955 a -582 em Z = 630) com Torres Gêmeas de 180m a 216m!
 * - Segunda Fileira "Quadra Mar" (Z = 480) com 18 Torres Residenciais de Luxo de 148m a 202m (38 a 52 andares)!
 */
function buildCoastalHotelBlocks(world, batcher) {
  const hotelColsX = [-582, -450, -318, -186, -60, 60, 186, 318, 450];

  // 1.1 Fileira Traseira "Quadra Mar" (Z = 480): 18 Super-Condomínios Costeiros (38 a 52 andares, 148m a 202m!)
  hotelColsX.forEach((hx, idx) => {
    const bw = Math.abs(hx) === 60 ? 92 : 104;
    const bd = 96;
    const innerW = bw - 10;
    const innerD = bd - 10;
    world._addCityBlockSidewalk(hx, 480, bw, bd, LEGO_COLORS.sidewalk);

    const lotW = (innerW - 6) * 0.5;
    const floors1 = 38 + (idx % 4) * 4;
    const floors2 = 42 + ((idx + 2) % 4) * 3;
    buildGenericHighRiseResort(world, batcher, hx - (lotW + 6) * 0.5, 480, lotW, innerD, floors1, idx * 2);
    buildGenericHighRiseResort(world, batcher, hx + (lotW + 6) * 0.5, 480, lotW, innerD, floors2, idx * 2 + 1);
  });

  // 1.2 Orla Oeste (X = -955, -832, -710, -582 em Z = 630): Torres Gêmeas Costeiras de 46 a 56 andares (180m a 218m!)
  // (Os 2 antigos prédios da direita em X = +582 foram removidos para abrir a Foz do Rio Urbano direto até o mar!)
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

  // Parque Linear & Estacionamento Costeiro Oeste (X = -1825..-1015, Z = 664..720, logo abaixo do Aeroporto)
  world._addCityBlockSidewalk(-1420, 690, 810, 52, LEGO_COLORS.sidewalk);
  batcher.addBox('palm_leaf', 796, 0.22, 24, -1420, 0.35, 682);
  for (let px = -1790; px <= -1040; px += 46) {
    addCurvedLegoPalmTree(batcher, px, 0.32, 682, 0.16, 0.85, 1.15);
  }

  // 1.3 OS 8 SUPER-ARRANHA-CÉUS EXCLUSIVOS DA ORLA ESTILO BALNEÁRIO CAMBORIÚ (X = -450 a +450 em Z = 630, 232m a 296m!)
  const signatureSpecs = [
    { x: -450, bw: 104, styleId: 1, floors: 68, height: 264, name: 'YACHTHOUSE TWIN TOWERS', color: '#06b6d4' },
    { x: -318, bw: 104, styleId: 2, floors: 74, height: 284, name: 'ONE TOWER BURJ NÁUTICO', color: '#38bdf8' },
    { x: -186, bw: 104, styleId: 3, floors: 60, height: 232, name: 'MILLENNIUM PALACE ROYAL', color: '#facc15' },
    { x: -60,  bw: 92,  styleId: 4, floors: 78, height: 296, name: 'SOLARIS INFINITY COAST', color: '#fb7185' },
    { x: 60,   bw: 92,  styleId: 5, floors: 72, height: 276, name: 'EPIC WAVE DIAMOND TOWER', color: '#2dd4bf' },
    { x: 186,  bw: 104, styleId: 6, floors: 64, height: 246, name: 'BOREAL HANGING GARDENS', color: '#fde047' },
    { x: 318,  bw: 104, styleId: 7, floors: 68, height: 260, name: 'AURORA NEON GRAND TOWER', color: '#ec4899' },
    { x: 450,  bw: 104, styleId: 8, floors: 62, height: 240, name: 'PHAROS PANORAMA SUITES', color: '#06b6d4' }
  ];

  signatureSpecs.forEach((spec) => {
    const bz = 630;
    const bd = 96;
    const w = spec.bw - 10;
    const d = bd - 10;
    world._addCityBlockSidewalk(spec.x, bz, spec.bw, bd, LEGO_COLORS.sidewalk);

    buildSignatureOceanfrontHotel(world, batcher, spec.x, bz, w, d, spec);

    // Coqueiros altos na calçada frontal de cada super-prédio da orla
    addCurvedLegoPalmTree(batcher, spec.x - w * 0.38, 0.3, 675.5, -0.18, 0.78, 1.15);
    addCurvedLegoPalmTree(batcher, spec.x + w * 0.38, 0.3, 675.5, 0.18, 0.78, 1.15);
  });
}

function buildGenericHighRiseResort(world, batcher, x, z, w, d, floors, seed, isFrontRow = false, signText = null) {
  const yBase = 0.3;
  const floorH = 3.8;
  const podiumH = 7.0;
  const totalH = podiumH + (floors - 1) * floorH;
  const palette = TROPICAL_WALL_KEYS[seed % TROPICAL_WALL_KEYS.length];
  const accentKey = UMBRELLA_KEYS[seed % UMBRELLA_KEYS.length];
  const glassKey = seed % 2 === 0 ? 'glass_cyan' : 'glass_sapphire';
  const neonKey = seed % 3 === 0 ? 'neon_cyan' : seed % 3 === 1 ? 'neon_gold' : 'neon_pink';

  // Podium de luxo com colunata e vitrines duplas
  batcher.addBox('trim_white', w, podiumH, d, x, yBase + podiumH * 0.5, z);
  batcher.addBox(glassKey, w - 3.0, podiumH - 1.4, d + 0.3, x, yBase + 3.2, z);

  const towerW = w - 4.0;
  const towerD = d - 6.0;
  const towerH = totalH - podiumH;
  batcher.addBox(palette.key, towerW, towerH, towerD, x, yBase + podiumH + towerH * 0.5, z);
  batcher.addBox(glassKey, towerW - 4.5, towerH - 2.0, towerD + 0.28, x, yBase + podiumH + towerH * 0.5, z);

  // Aletas verticais aerodinâmicas estilo Balneário Camboriú + Fita de LED vertical
  batcher.addBox('trim_white', 2.4, towerH + 6.0, towerD + 1.4, x - towerW * 0.5 + 1.2, yBase + podiumH + towerH * 0.5 + 3.0, z);
  batcher.addBox('trim_white', 2.4, towerH + 6.0, towerD + 1.4, x + towerW * 0.5 - 1.2, yBase + podiumH + towerH * 0.5 + 3.0, z);
  batcher.addBox(neonKey, 1.1, towerH + 8.0, 1.2, x, yBase + podiumH + towerH * 0.5 + 4.0, z + towerD * 0.5 + 0.9);

  // Sacadas salientes panorâmicas a cada 3 andares (otimizado para memória e 60 FPS)
  for (let f = 1; f < floors; f += 3) {
    const fy = yBase + podiumH + (f - 1) * floorH;
    batcher.addBox('trim_white', towerW - 2.4, 0.42, 2.2, x, fy + 0.2, z + towerD * 0.5 + 1.0);
    batcher.addBox('glass_cyan', towerW - 2.4, 1.0, 0.2, x, fy + 0.85, z + towerD * 0.5 + 2.0);
  }

  // Coroa Escalonada Iluminada + Pináculo no Topo
  const roofY = yBase + totalH;
  batcher.addBox('trim_white', towerW + 2.0, 1.8, towerD + 2.0, x, roofY + 0.9, z);
  batcher.addBox('pool_water', towerW * 0.48, 0.6, towerD * 0.38, x, roofY + 1.9, z + 4.0);
  batcher.addBox(accentKey, towerW * 0.52, 6.5, towerD * 0.42, x, roofY + 5.0, z - 6.0);
  batcher.addBox(neonKey, towerW * 0.34, 4.5, towerD * 0.28, x, roofY + 10.5, z - 6.0);
  batcher.addBox('trim_white', 1.2, 14.0, 1.2, x, roofY + 19.5, z - 6.0);

  if (signText) {
    addNeonHotelSign(world, x, roofY + 4.5, z + towerD * 0.5 + 1.2, 34, signText);
  }

  world.addCollider(x, z, w, d, roofY + 2.0, yBase);
  world.mapBuildings.push({ x, z, w, d, height: totalH, color: palette.mapColor, label: signText || 'TORRE QUADRA MAR' });
  world.southBeachHotels.push({ x, z, w, d, floors, height: totalH, hasRooftopPool: true, isFrontRow });
}

/**
 * Constrói cada um dos 8 Super-Arranha-Céus Exclusivos na Orla Estilo Balneário Camboriú (232m a 296m de altura!)
 */
function buildSignatureOceanfrontHotel(world, batcher, x, z, w, d, spec) {
  const yBase = 0.3;
  const podiumH = 8.5;
  const H = spec.height;
  const southZ = z + d * 0.5;

  // Base Podium de Luxo (Boulevard Atlântico, Vitrines Duplas, Toldos e Mesas na Calçada)
  batcher.addBox('trim_white', w, podiumH, d, x, yBase + podiumH * 0.5, z);
  batcher.addBox('glass_cyan', w - 3.0, podiumH - 1.8, d + 0.3, x, yBase + 3.8, z);

  for (let mx = x - w * 0.38; mx <= x + w * 0.38; mx += 14) {
    const awColor = UMBRELLA_KEYS[Math.abs(Math.round(mx)) % UMBRELLA_KEYS.length];
    batcher.addBox(awColor, 10.5, 0.5, 2.8, mx, yBase + 5.6, southZ + 1.3);
    batcher.addBox('trim_white', 1.5, 0.8, 1.5, mx, yBase + 0.4, southZ + 2.5);
    batcher.addBox(awColor, 2.6, 0.38, 2.6, mx, yBase + 2.3, southZ + 2.5);
  }

  if (spec.styleId === 1) {
    // TORRE 1 (X=-450, 264m / 68 andares): YACHTHOUSE TWIN TOWERS (Duas Super-Torres Gêmeas Aerodinâmicas + 2 Skybridges!)
    const tw = (w - 16) * 0.5;
    const td = d - 8;
    const towerH = H - podiumH;
    const leftX = x - tw * 0.5 - 5.0;
    const rightX = x + tw * 0.5 + 5.0;

    for (const tx of [leftX, rightX]) {
      batcher.addBox('coastal_white', tw, towerH, td, tx, yBase + podiumH + towerH * 0.5, z);
      batcher.addBox('glass_sapphire', tw - 3.5, towerH - 3, td + 0.35, tx, yBase + podiumH + towerH * 0.5, z);
      // Quinas aerodinâmicas brancas estilo Pininfarina Yachthouse
      batcher.addBox('trim_white', 3.2, towerH + 10, td + 1.8, tx - tw * 0.5 + 1.4, yBase + podiumH + towerH * 0.5 + 5, z);
      batcher.addBox('trim_white', 3.2, towerH + 10, td + 1.8, tx + tw * 0.5 - 1.4, yBase + podiumH + towerH * 0.5 + 5, z);
      batcher.addBox('neon_cyan', 1.2, towerH + 14, 1.2, tx, yBase + podiumH + towerH * 0.5 + 7, z + td * 0.5 + 1.1);

      for (let fy = yBase + podiumH + 5; fy < H - 4; fy += 5.2) {
        batcher.addBox('coastal_turquoise', tw + 1.4, 0.4, 2.4, tx, fy, z + td * 0.5 + 1.0);
        batcher.addBox('trim_white', tw + 1.6, 0.9, 0.22, tx, fy + 0.6, z + td * 0.5 + 2.1);
      }
      // Coroa de Iate Aerodinâmica + Heliponto e Antena no topo de cada torre gêmea (até 292m!)
      batcher.addBox('neon_cyan', tw - 3, 4.5, td - 4, tx, H + 2.25, z);
      batcher.addBox('trim_white', tw - 8, 11.0, td - 10, tx, H + 10.0, z);
      batcher.addBox('neon_gold', 1.4, 14.0, 1.4, tx, H + 22.0, z);
    }

    // SKYBRIDGE INFERIOR (Y = 115m) + SKYDECK SUPERIOR COM PISCINA SUSPENSA NAS NUVENS (Y = 205m)!
    batcher.addBox('trim_white', w - 10, 5.5, 18, x, 115.0, z + 2);
    batcher.addBox('glass_cyan', w - 12, 3.8, 18.4, x, 115.0, z + 2);

    batcher.addBox('trim_white', w - 8, 7.0, 24, x, 205.0, z + 4);
    batcher.addBox('glass_sapphire', w - 10, 4.8, 24.4, x, 205.0, z + 4);
    batcher.addBox('pool_water', 28, 0.9, 15, x, 208.8, z + 4);
    addNeonHotelSign(world, x, 211.0, z + 16.8, 38, spec.name, '#00f0ff', '#facc15');
  } else if (spec.styleId === 2) {
    // TORRE 2 (X=-318, 284m / 74 andares): ONE TOWER BURJ NÁUTICO (5 Estágios Escalonados + Pináculo até 312m!)
    const tiers = [
      { h: 62, w: w - 4,  d: d - 4,  zOff: 0 },
      { h: 58, w: w - 14, d: d - 10, zOff: 2.5 },
      { h: 56, w: w - 24, d: d - 16, zOff: 5.0 },
      { h: 54, w: w - 36, d: d - 22, zOff: 7.5 },
      { h: 45.5, w: w - 48, d: d - 28, zOff: 10.0 }
    ];
    let curY = yBase + podiumH;
    tiers.forEach((t) => {
      batcher.addBox('glass_sapphire', t.w, t.h, t.d, x, curY + t.h * 0.5, z + t.zOff);
      batcher.addBox('trim_white', 4.8, t.h, t.d + 1.4, x - t.w * 0.5, curY + t.h * 0.5, z + t.zOff);
      batcher.addBox('trim_white', 4.8, t.h, t.d + 1.4, x + t.w * 0.5, curY + t.h * 0.5, z + t.zOff);
      batcher.addBox('neon_cyan', 1.5, t.h, 1.6, x, curY + t.h * 0.5, z + t.zOff + t.d * 0.5 + 0.9);
      for (let fy = curY + 4.5; fy < curY + t.h; fy += 5.2) {
        batcher.addBox('trim_white', t.w + 1.8, 0.38, 2.2, x, fy, z + t.zOff + t.d * 0.5 + 0.9);
      }
      // Piscina infinita e mirante em cada degrau da Vela!
      batcher.addBox('pool_water', t.w * 0.52, 0.55, 6.2, x, curY + t.h + 0.3, z + t.zOff - t.d * 0.25);
      curY += t.h;
    });
    // Heliponto Suspenso e Pináculo One Tower no Topo (284m -> 312m!)
    batcher.addBox('trim_white', 26, 2.0, 26, x, curY + 1.0, z + 10);
    batcher.addBox('neon_cyan', 16, 6.0, 16, x, curY + 5.0, z + 10);
    batcher.addBox('neon_gold', 1.8, 22.0, 1.8, x, curY + 19.0, z + 10);
    addNeonHotelSign(world, x, 128, southZ + 0.5, 38, spec.name, '#38bdf8', '#ffffff');
  } else if (spec.styleId === 3) {
    // TORRE 3 (X=-186, 232m / 60 andares): MILLENNIUM PALACE ROYAL (Arranha-Céu Neoclássico Imperial Branco e Ouro!)
    const wingW = 24;
    const wingH = 148;
    // Alas Laterais Altas (148m) + Torre Imperial Central de 232m!
    batcher.addBox('coastal_white', wingW, wingH, d - 6, x - w * 0.5 + wingW * 0.5 + 2, yBase + podiumH + wingH * 0.5, z);
    batcher.addBox('coastal_white', wingW, wingH, d - 6, x + w * 0.5 - wingW * 0.5 - 2, yBase + podiumH + wingH * 0.5, z);
    batcher.addBox('coastal_gold', wingW - 4, 4.5, d - 10, x - w * 0.5 + wingW * 0.5 + 2, yBase + podiumH + wingH + 2.25, z);
    batcher.addBox('coastal_gold', wingW - 4, 4.5, d - 10, x + w * 0.5 - wingW * 0.5 - 2, yBase + podiumH + wingH + 2.25, z);

    batcher.addBox('coastal_white', w - 24, H - podiumH, d - 10, x, yBase + podiumH + (H - podiumH) * 0.5, z - 3);
    // Pilastras douradas verticais contínuas subindo até 232m
    batcher.addBox('coastal_gold', 3.2, H - podiumH, d - 8, x - (w - 28) * 0.5, yBase + podiumH + (H - podiumH) * 0.5, z - 3);
    batcher.addBox('coastal_gold', 3.2, H - podiumH, d - 8, x + (w - 28) * 0.5, yBase + podiumH + (H - podiumH) * 0.5, z - 3);

    // Frisos Dourados Imperiais + Janelas Iluminadas Quentes
    for (let fy = yBase + podiumH + 5; fy < H - 4; fy += 6.0) {
      batcher.addBox('coastal_gold', w - 22, 0.6, d - 8, x, fy, z - 3);
      batcher.addBox('window_warm', w - 28, 2.4, 0.45, x, fy + 2.5, z - 3 + (d - 10) * 0.5 + 0.25);
    }
    // Cúpula Real Escalonada + Obelisco Dourado no Topo (232m a 264m!)
    batcher.addBox('coastal_gold', 32, 9.0, 32, x, H + 4.5, z - 3);
    batcher.addBox('neon_gold', 20, 11.0, 20, x, H + 14.5, z - 3);
    batcher.addBox('trim_white', 2.2, 14.0, 2.2, x, H + 26.5, z - 3);
    batcher.addBox('pool_water', 34, 0.7, 16, x, yBase + podiumH + 0.4, z + 22);
    addNeonHotelSign(world, x, H + 3.5, z + (d - 10) * 0.5 - 2.0, 38, spec.name, '#facc15', '#fef08a');
  } else if (spec.styleId === 4) {
    // TORRE 4 (X=-60, 296m / 78 andares): SOLARIS INFINITY COAST (O Mais Alto da Orla: 296m + 2 Átrios Panorâmicos Vazados!)
    const towerW = w - 4;
    const towerD = d - 6;
    const lowerH = 96;
    const atrium1H = 22;
    const midH = 74;
    const atrium2H = 22;
    const upperH = H - podiumH - lowerH - atrium1H - midH - atrium2H;

    // 1) Bloco Inferior (Y=8.8m até Y=104.8m)
    batcher.addBox('coastal_coral', towerW, lowerH, towerD, x, yBase + podiumH + lowerH * 0.5, z);
    batcher.addBox('glass_cyan', towerW - 8, lowerH - 2, towerD + 0.3, x, yBase + podiumH + lowerH * 0.5, z);

    // 2) 1º Átrio Panorâmico Vazado (Y=104.8m a 126.8m) com Piscina Suspensa e Coqueiros!
    const at1Y = yBase + podiumH + lowerH;
    batcher.addBox('coastal_coral', 18, atrium1H, towerD, x - towerW * 0.5 + 9, at1Y + atrium1H * 0.5, z);
    batcher.addBox('coastal_coral', 18, atrium1H, towerD, x + towerW * 0.5 - 9, at1Y + atrium1H * 0.5, z);
    batcher.addBox('pool_water', towerW - 36, 0.9, 18, x, at1Y + 0.5, z + 6);
    addCurvedLegoPalmTree(batcher, x - 8, at1Y + 0.5, z, -0.2, 0.7, 1.0);
    addCurvedLegoPalmTree(batcher, x + 8, at1Y + 0.5, z, 0.2, 0.7, 1.0);

    // 3) Bloco Intermediário (Y=126.8m a 200.8m)
    const midY = at1Y + atrium1H;
    batcher.addBox('coastal_coral', towerW, midH, towerD, x, midY + midH * 0.5, z);
    batcher.addBox('glass_cyan', towerW - 8, midH - 2, towerD + 0.3, x, midY + midH * 0.5, z);

    // 4) 2º Átrio Panorâmico nas Nuvens (Y=200.8m a 222.8m) com Sky-Pool!
    const at2Y = midY + midH;
    batcher.addBox('coastal_coral', 18, atrium2H, towerD, x - towerW * 0.5 + 9, at2Y + atrium2H * 0.5, z);
    batcher.addBox('coastal_coral', 18, atrium2H, towerD, x + towerW * 0.5 - 9, at2Y + atrium2H * 0.5, z);
    batcher.addBox('pool_water', towerW - 36, 0.9, 18, x, at2Y + 0.5, z + 6);

    // 5) Bloco Superior (Y=222.8m até Y=296m!)
    const topStart = at2Y + atrium2H;
    batcher.addBox('coastal_coral', towerW, upperH, towerD, x, topStart + upperH * 0.5, z);
    batcher.addBox('glass_cyan', towerW - 8, upperH - 2, towerD + 0.3, x, topStart + upperH * 0.5, z);

    // Varandas Onduladas Douradas/Solares ao longo dos 296m!
    for (let fy = yBase + podiumH + 4; fy < H - 2; fy += 5.2) {
      if ((fy > at1Y && fy < midY) || (fy > at2Y && fy < topStart)) continue;
      const waveShift = Math.sin(fy * 0.12) * 2.8;
      batcher.addBox('coastal_sun', towerW - 4, 0.42, 2.6, x + waveShift, fy, z + towerD * 0.5 + 1.1);
      batcher.addBox('glass_cyan', towerW - 4, 0.95, 0.22, x + waveShift, fy + 0.65, z + towerD * 0.5 + 2.2);
    }

    // Coroa Solar Monumental e Pináculo no Topo (Y = 296m -> 318m!)
    batcher.addBox('neon_gold', towerW + 3, 3.2, towerD + 3, x, H + 1.6, z);
    batcher.addBox('pool_water', towerW * 0.6, 0.8, 16, x, H + 3.4, z + 8);
    batcher.addBox('trim_white', 22, 9.0, 22, x, H + 7.5, z - 8);
    batcher.addBox('neon_gold', 2.0, 18.0, 2.0, x, H + 20.0, z - 8);
    addNeonHotelSign(world, x, H + 5.5, z + towerD * 0.5 + 1.5, 38, spec.name, '#fb7185', '#fde047');
  } else if (spec.styleId === 5) {
    // TORRE 5 (X=+60, 276m / 72 andares): EPIC WAVE DIAMOND TOWER (Torre Cristalina de 276m com Elevador Panorâmico Neon!)
    const towerW = w - 4;
    const towerD = d - 6;
    const towerH = H - podiumH;

    batcher.addBox('coastal_aqua', towerW, towerH, towerD, x, yBase + podiumH + towerH * 0.5, z);
    batcher.addBox('glass_sapphire', towerW - 5, towerH - 2, towerD + 0.35, x, yBase + podiumH + towerH * 0.5, z);

    // Coluna Central do Elevador Panorâmico Externo subindo 286m com Cápsulas Luminosas!
    batcher.addBox('trim_white', 7.0, towerH + 10, 3.8, x, yBase + podiumH + towerH * 0.5 + 5, z + towerD * 0.5 + 1.5);
    batcher.addBox('neon_cyan', 4.4, towerH + 8, 4.1, x, yBase + podiumH + towerH * 0.5 + 5, z + towerD * 0.5 + 1.6);

    for (let fy = yBase + podiumH + 4.5; fy < H - 3; fy += 5.2) {
      batcher.addBox('trim_white', (towerW - 12) * 0.46, 0.42, 2.4, x - towerW * 0.27, fy, z + towerD * 0.5 + 1.1);
      batcher.addBox('trim_white', (towerW - 12) * 0.46, 0.42, 2.4, x + towerW * 0.27, fy, z + towerD * 0.5 + 1.1);
    }

    // Coroa Cristalina & Sky-Club no Topo (276m -> 300m!)
    batcher.addBox('trim_white', towerW + 2.5, 2.4, towerD + 2.5, x, H + 1.2, z);
    batcher.addBox('pool_water', towerW * 0.55, 0.75, 16, x, H + 2.6, z + 6);
    batcher.addBox('neon_cyan', towerW * 0.42, 10.0, towerD * 0.42, x, H + 7.4, z - 6);
    batcher.addBox('trim_white', 1.8, 16.0, 1.8, x, H + 20.0, z - 6);
    addNeonHotelSign(world, x, H + 5.5, z + towerD * 0.5 + 2.2, 38, spec.name, '#00f0ff', '#ffffff');
  } else if (spec.styleId === 6) {
    // TORRE 6 (X=+186, 246m / 64 andares): BOREAL HANGING GARDENS (7 Terraços Escalonados Gigantes com Piscinas e Coqueiros!)
    const steps = 7;
    const stepH = (H - podiumH) / steps;
    let curY = yBase + podiumH;

    for (let s = 0; s < steps; s++) {
      const sw = w - 4 - s * 8.5;
      const sd = d - 6 - s * 6.8;
      const zOff = -s * 2.4; // Recua deixando grandes terraços ensolarados virados pro mar (+Z)!
      const wallKey = s % 2 === 0 ? 'coastal_sun' : 'coastal_coral';

      batcher.addBox(wallKey, sw, stepH, sd, x, curY + stepH * 0.5, z + zOff);
      batcher.addBox('glass_cyan', sw - 4, stepH - 1.8, sd + 0.3, x, curY + stepH * 0.5, z + zOff);
      batcher.addBox('trim_white', sw + 1.8, 0.9, sd + 1.8, x, curY + stepH, z + zOff);

      // Jardim Suspenso com Piscina e Coqueiros em cada terraço!
      const terraceZ = z + zOff + sd * 0.5 - 3.2;
      batcher.addBox('pool_water', sw * 0.5, 0.55, 5.0, x, curY + stepH + 0.35, terraceZ);
      addCurvedLegoPalmTree(batcher, x - sw * 0.36, curY + stepH + 0.3, terraceZ, -0.2, 0.75, 0.88);
      addCurvedLegoPalmTree(batcher, x + sw * 0.36, curY + stepH + 0.3, terraceZ, 0.2, 0.75, 0.88);

      curY += stepH;
    }
    batcher.addBox('neon_gold', 2.0, 18.0, 2.0, x, H + 9.0, z - 14);
    addNeonHotelSign(world, x, H + 4.0, z - 10, 38, spec.name, '#fde047', '#fb7185');
  } else if (spec.styleId === 7) {
    // TORRE 7 (X=+318, 260m / 68 andares): AURORA NEON GRAND TOWER (Super-Torre Art-Déco de 260m com 4 Tubos Verticais de Neon!)
    const towerW = w - 6;
    const towerD = d - 8;
    const towerH = H - podiumH;

    batcher.addBox('coastal_white', towerW, towerH, towerD, x, yBase + podiumH + towerH * 0.5, z);
    batcher.addBox('umb_pink', towerW * 0.56, towerH + 8, towerD + 1.0, x, yBase + podiumH + towerH * 0.5 + 4, z);

    // 4 Tubos Verticais de Neon Ciano subindo até 268m!
    for (const nx of [-towerW * 0.38, -towerW * 0.18, towerW * 0.18, towerW * 0.38]) {
      batcher.addBox('neon_cyan', 1.6, towerH + 6, 1.6, x + nx, yBase + podiumH + towerH * 0.5 + 3, z + towerD * 0.5 + 0.9);
    }

    for (let fy = yBase + podiumH + 4.5; fy < H - 3; fy += 5.2) {
      batcher.addBox('trim_white', towerW + 1.8, 0.42, 2.4, x, fy, z + towerD * 0.5 + 1.1);
      batcher.addBox('neon_pink', towerW * 0.52, 0.28, 2.6, x, fy + 0.22, z + towerD * 0.5 + 1.2);
    }

    // Coroa Art-Déco Escalonada + Pináculo e Piscina de Cobertura (260m -> 286m!)
    batcher.addBox('neon_cyan', towerW * 0.42, 12, towerD * 0.42, x, H + 9, z);
    batcher.addBox('neon_pink', 2.0, 16, 2.0, x, H + 23, z);
    batcher.addBox('pool_water', towerW * 0.5, 0.75, 15, x, H + 1.5, z + 10);
    addNeonHotelSign(world, x, H + 4.8, z + towerD * 0.5 + 1.6, 38, spec.name, '#ec4899', '#00f0ff');
  } else {
    // TORRE 8 (X=+450, 240m / 62 andares): PHAROS PANORAMA SUITES (Super-Torre Costeira com Restaurante Giratório 360° a 240m!)
    const towerW = w - 10;
    const towerD = d - 10;
    const towerH = H - podiumH;

    batcher.addBox('coastal_turquoise', towerW, towerH, towerD, x, yBase + podiumH + towerH * 0.5, z);
    // Chanfros / Colunas Brancas nas 4 quinas dando aspecto octogonal de Balneário Camboriú
    batcher.addBox('trim_white', towerW - 14, towerH + 4, towerD + 3.2, x, yBase + podiumH + towerH * 0.5 + 2, z);
    batcher.addBox('glass_cyan', towerW - 18, towerH - 2, towerD + 3.6, x, yBase + podiumH + towerH * 0.5, z);

    for (let fy = yBase + podiumH + 4.5; fy < H - 4; fy += 5.2) {
      batcher.addBox('trim_white', towerW + 2.2, 0.42, towerD + 2.2, x, fy, z);
    }

    // Restaurante Panorâmico Circular/Octogonal no Topo (Y = 240m a 256m) + Farol Costeiro (até 272m!)
    batcher.addBox('trim_white', towerW + 7, 3.4, towerD + 7, x, H + 1.7, z);
    batcher.addBox('window_warm', towerW + 5, 6.5, towerD + 5, x, H + 6.6, z);
    batcher.addBox('umb_red', towerW - 5, 3.5, towerD - 5, x, H + 11.6, z);
    batcher.addBox('neon_gold', 2.2, 18.0, 2.2, x, H + 22.0, z);
    batcher.addBox('pool_water', 26, 0.7, 13, x, H + 3.6, z + towerD * 0.35);
    addNeonHotelSign(world, x, H + 4.5, z + towerD * 0.5 + 4.0, 38, spec.name, '#06b6d4', '#fde047');
  }

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
    batcher.addBox('bike_red', CANAL_WIDTH + 4, 0.06, 4.6, cx, 0.5, 731);
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

    batcher.addBox('bike_red', segW, 0.05, 4.6, segCenterX, 0.33, 731);
    batcher.addBox('trim_white', segW, 0.06, 0.25, segCenterX, 0.34, 728.6);
    batcher.addBox('trim_white', segW, 0.06, 0.25, segCenterX, 0.34, 733.4);
  }

  // Padrão de Pedras Portuguesas em Ondas Pretas e Brancas + Coqueiros + Bancos (de X = -1800 até +528 na margem da Foz do Rio)
  for (let wx = -1800; wx <= 528; wx += 16) {
    if (isInsideSantosCanal(wx, 4)) continue;
    const waveOffset = Math.sin(wx * 0.06) * 4.5;
    batcher.addBox('stone_black', 14.0, 0.04, 3.6, wx, 0.33, bwZ - 6 + waveOffset);
    batcher.addBox('stone_black', 14.0, 0.04, 3.6, wx, 0.33, bwZ + 8 - waveOffset);
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
  batcher.addBox('coastal_turquoise', 1.8, 2.8, 1.4, kx + 2.2, yBase + 1.5, kz - 1.2);
  batcher.addBox('glass_cyan', 1.5, 2.2, 1.48, kx + 2.2, yBase + 1.6, kz - 1.2);

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
    const sandSeg = createLegoBrick(segW, 0.28, 258, 0xfde047, {
      studs: false,
      roughness: 0.62
    });
    sandSeg.position.set(segCenterX, -0.02, 907);
    world.scene.add(sandSeg);
    world.mapBlocks.push({ x: segCenterX, z: 907, w: segW, d: 258, color: '#fde047' });

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
      const uColor = UMBRELLA_KEYS[Math.floor(Math.random() * UMBRELLA_KEYS.length)];
      const towelColor = UMBRELLA_KEYS[Math.floor(Math.random() * UMBRELLA_KEYS.length)];

      batcher.addBox('trim_white', 0.22, 3.1, 0.22, jitterX, sandY + 1.55, jitterZ);
      batcher.addBox(uColor, 4.4, 0.42, 4.4, jitterX, sandY + 3.1, jitterZ);
      batcher.addBox('trim_white', 2.8, 0.38, 2.8, jitterX, sandY + 3.45, jitterZ);
      batcher.addBox(uColor, 1.2, 0.32, 1.2, jitterX, sandY + 3.75, jitterZ);

      batcher.addBox('trim_white', 1.25, 0.32, 2.4, jitterX - 1.7, sandY + 0.16, jitterZ + 0.4);
      batcher.addBox('trim_white', 1.25, 0.55, 0.5, jitterX - 1.7, sandY + 0.38, jitterZ - 0.6);
      batcher.addBox(towelColor, 1.4, 0.06, 2.5, jitterX + 1.7, sandY + 0.03, jitterZ + 0.5);
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
    [-85, 935],  [-68, 990],  [-58, 845],  [-175, 975],
    [62, 975],   [75, 845],   [95, 990],   [145, 935],
    [195, 1005], [305, 945],  [355, 995],  [420, 955]
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
  batcher.addBox('coastal_white', 24, 5.2, 34, restX, deckTopY + 2.6, restZ);
  batcher.addBox('glass_cyan', 22, 3.6, 34.4, restX, deckTopY + 2.4, restZ);
  batcher.addBox('wood_deck', 26, 0.6, 36, restX, deckTopY + 5.5, restZ); // Piso do 2º andar
  batcher.addBox('coastal_turquoise', 16, 4.4, 20, restX - 3, deckTopY + 7.8, restZ - 4);
  batcher.addBox('umb_orange', 18, 0.9, 22, restX - 3, deckTopY + 10.4, restZ - 4);
  // Mesas com guarda-sol no terraço do 2º andar do restaurante!
  for (const tz of [restZ + 8, restZ + 14]) {
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, restX + 5, deckTopY + 6.2, tz);
    batcher.addBox('umb_red', 3.2, 0.4, 3.2, restX + 5, deckTopY + 8.2, tz);
  }
  addNeonHotelSign(world, restX + 12.5, deckTopY + 8.5, restZ, 24, 'RESTAURANTE DO PÍER', '#fb923c', '#ffffff');
  world.addCollider(restX, restZ, 25, 35, deckTopY + 10.5, deckTopY);

  // 3. FLIPERAMA / ARCADE NEON 3D (X = +28, Z = 1125)
  const arcX = 28;
  const arcZ = 1125;
  batcher.addBox('stone_black', 24, 8.8, 34, arcX, deckTopY + 4.4, arcZ);
  batcher.addBox('neon_cyan', 25, 0.8, 35, arcX, deckTopY + 8.6, arcZ);
  batcher.addBox('neon_pink', 25, 0.8, 35, arcX, deckTopY + 4.8, arcZ);
  batcher.addBox('window_warm', 20, 3.2, 34.4, arcX, deckTopY + 2.2, arcZ);
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

  // 5. MONTANHA-RUSSA COSTEIRA NO PÍER (Trilhos Vermelhos/Amarelos em Arcos Elevados em X = -36, Z = 1230..1390)
  for (let cz = 1235; cz <= 1385; cz += 10) {
    const waveH = 8.0 + Math.sin((cz - 1235) * 0.06) * 6.5;
    batcher.addBox('trim_white', 1.0, waveH, 1.0, -38, deckTopY + waveH * 0.5, cz);
    batcher.addBox('umb_red', 4.2, 0.75, 10.5, -38, deckTopY + waveH, cz);
    batcher.addBox('umb_yellow', 2.8, 0.45, 10.5, -38, deckTopY + waveH + 0.5, cz);
  }

  // 6. CARROSSEL CLÁSSICO GIRATÓRIO 3D (X = -22, Z = 1325) — Gira continuamente no loop!
  const carouselGroup = new THREE.Group();
  carouselGroup.position.set(-22, deckTopY, 1325);
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
  world.addCollider(-22, 1325, 18, 18, deckTopY + 12, deckTopY);

  // 7. TORRE DE QUEDA LIVRE "BIG DROP" DE 58m DE ALTURA! (X = +24, Z = 1325)
  const dropX = 24;
  const dropZ = 1325;
  const dropH = 58.0;
  batcher.addBox('umb_red', 5.2, dropH, 5.2, dropX, deckTopY + dropH * 0.5, dropZ);
  batcher.addBox('umb_yellow', 6.4, 3.2, 6.4, dropX, deckTopY + dropH, dropZ);
  batcher.addBox('neon_cyan', 7.8, 1.8, 7.8, dropX, deckTopY + dropH + 2.2, dropZ);
  // Gôndola de Assentos na metade da torre
  batcher.addBox('neon_pink', 9.2, 2.4, 9.2, dropX, deckTopY + 26.0, dropZ);
  world.addCollider(dropX, dropZ, 8.5, 8.5, deckTopY + dropH + 3.0, deckTopY);

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
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    cabinGlass.position.y = 0.45;
    const cabinRoof = createLegoBrick(5.2, 0.6, 4.2, cabinColor);
    cabinRoof.position.y = 1.35;

    cabinGroup.add(cabinBody, cabinGlass, cabinRoof);
    cabinGroup.position.set(0, sinA * wheelRadius, cosA * wheelRadius);
    wheelGroup.add(cabinGroup);
  }

  world.scene.add(wheelGroup);
  world.ferrisWheelGroup = wheelGroup;
  world.ferrisWheelCabinCount = cabinCount;
  world.pierData = { zStart: 1030, zEnd: 1570, length: 540, width: mainPierW, plazaWidth: endPlazaW };
  world.rotatingElements.push({ mesh: wheelGroup, axis: 'x', speed: 0.42 });

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
  batcher.addBox('coastal_white', 38, 6.4, 16, westMarinaX, 4.0, 1030);
  batcher.addBox('glass_cyan', 34, 4.2, 16.4, westMarinaX, 3.6, 1030);
  batcher.addBox('coastal_turquoise', 42, 1.2, 19, westMarinaX, 7.8, 1030);
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
