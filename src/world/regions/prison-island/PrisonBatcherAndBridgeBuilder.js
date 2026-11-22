import * as THREE from 'three';
import { makeFastBox, flushSpatialChunkedBuckets } from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ws, wsP } from '../../core/WorldLayoutScale.js';

export const DESIGN_PRISON_CENTER = Object.freeze({ x: 1375, z: 1540 });
export const PRISON_COMPOUND_ORIGIN = Object.freeze(wsP(DESIGN_PRISON_CENTER.x, DESIGN_PRISON_CENTER.z));
export const PRISON_OFFSET_X = PRISON_COMPOUND_ORIGIN.x - DESIGN_PRISON_CENTER.x;
export const PRISON_OFFSET_Z = PRISON_COMPOUND_ORIGIN.z - DESIGN_PRISON_CENTER.z;

export const DESIGN_PRISON_DOCK = Object.freeze({ x: 928, z: 1550 });
export const PRISON_DOCK_ORIGIN = Object.freeze(wsP(DESIGN_PRISON_DOCK.x, DESIGN_PRISON_DOCK.z));
export const PRISON_DOCK_OFFSET_X = PRISON_DOCK_ORIGIN.x - DESIGN_PRISON_DOCK.x;
export const PRISON_DOCK_OFFSET_Z = PRISON_DOCK_ORIGIN.z - DESIGN_PRISON_DOCK.z;

/**
 * Acumulador de Geometrias 3D da Grande Ponte Blindada Estaiada & Ilha da Prisão de Segurança Máxima (2x Maior):
 * Funde milhares de peças LEGO (Ponte, Torres Estaiadas de 94m com Cabos Corrigidos, 2 Checkpoints do BOPE,
 * 140+ Rochas Costeiras, Doca Naval da Guarda Costeira, Muralhas de 40m, 8 Torres de Vigia de 68m,
 * Cidadela Panóptica Central "A Balsa" de 126m com 4 Passarelas Aéreas e Duplo Heliponto,
 * 6 Pavilhões Penitenciários Altos de 58m-82m com Ala Ômega Laser e 24 Celas Térreas Visíveis,
 * e 4 Setores de Pátio 100% Preenchidos com Passarelas Elevadas de Ronda) em ~24 Draw Calls para manter 60 FPS!
 */
export class PrisonIslandBatcher {
  constructor() {
    this.buckets = new Map();
    this.materials = new Map();
    this.castShadowKeys = new Set([
      'matte_black',
      'gunmetal_concrete',
      'armor_slate',
      'dark_steel',
      'alert_yellow',
      'bope_black',
      'prison_orange'
    ]);
    this._initMaterials();
  }

  _registerMat(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    if (opts.basic) {
      this.materials.set(
        key,
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: opts.transparent ?? false,
          opacity: opts.opacity ?? 1.0
        })
      );
    } else {
      const r = opts.roughness ?? 0.36;
      this.materials.set(
        key,
        new THREE.MeshPhysicalMaterial({
          color: colorHex,
          roughness: r,
          metalness: opts.metalness ?? 0.14,
          clearcoat: r > 0.52 ? 0.0 : 0.36,
          clearcoatRoughness: 0.16,
          reflectivity: 0.7,
          emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
          emissiveIntensity: opts.emissiveIntensity ?? 0
        })
      );
    }
  }

  _initMaterials() {
    this._registerMat('matte_black', 0x090a0d, { roughness: 0.44, metalness: 0.22 });
    this._registerMat('bope_black', 0x111827, { roughness: 0.34, metalness: 0.28 });
    this._registerMat('gunmetal_concrete', 0x1e293b, { roughness: 0.56, metalness: 0.12 });
    this._registerMat('armor_slate', 0x334155, { roughness: 0.48, metalness: 0.18 });
    this._registerMat('dark_steel', 0x0f172a, { roughness: 0.32, metalness: 0.45 });
    this._registerMat('yard_concrete', 0x475569, { roughness: 0.62, metalness: 0.06 });
    this._registerMat('coastal_rock', 0x18181b, { roughness: 0.78, metalness: 0.05 });
    this._registerMat('sea_foam', 0xe2e8f0, { basic: true });
    this._registerMat('brushed_silver', 0xcbd5e1, { roughness: 0.26, metalness: 0.52 });
    this._registerMat('chainlink_mesh', 0x94a3b8, { roughness: 0.35, metalness: 0.48 });
    this._registerMat('tactical_white', 0xf8fafc, { roughness: 0.25, metalness: 0.08 });
    this._registerMat('alert_yellow', 0xfacc15, { roughness: 0.28, metalness: 0.12 });
    this._registerMat('police_blue', 0x1d4ed8, { roughness: 0.26, metalness: 0.18 });
    this._registerMat('court_blue', 0x0284c7, { roughness: 0.45, metalness: 0.05 });
    this._registerMat('futsal_green', 0x15803d, { roughness: 0.45, metalness: 0.05 });
    this._registerMat('prison_orange', 0xf97316, { roughness: 0.26, metalness: 0.05 });
    this._registerMat('cv_red', 0xdc2626, { roughness: 0.26, metalness: 0.08 });
    this._registerMat('pcc_navy', 0x1e3a8a, { roughness: 0.28, metalness: 0.15 });
    this._registerMat('ares_purple', 0x9333ea, {
      roughness: 0.22,
      metalness: 0.35,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.45
    });
    this._registerMat('laser_cyan', 0x38bdf8, { basic: true });
    this._registerMat('laser_purple', 0xc084fc, { basic: true });
    this._registerMat('lego_skin', 0xfde047, { roughness: 0.24, metalness: 0.04 });
    this._registerMat('smoked_glass', 0x0ea5e9, {
      roughness: 0.14,
      metalness: 0.38,
      emissive: 0x0369a1,
      emissiveIntensity: 0.28
    });
    this._registerMat('searchlight_white', 0xffffff, { basic: true });
    this._registerMat('searchlight_beam', 0xe0f2fe, { basic: true, transparent: true, opacity: 0.22 });
    this._registerMat('siren_red', 0xef4444, { basic: true });
    this._registerMat('siren_blue', 0x38bdf8, { basic: true });
  }

  addBox(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const list = this.buckets.get(key);
    if (!list) return;
    if (rx === 0 && ry === 0 && rz === 0) {
      list.push(makeFastBox(w, h, d, x, y, z));
    } else {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      list.push(g);
    }
  }

  /**
   * Conecta o ponto (x1, y1, z1) exatamente ao ponto (x2, y2, z2) usando Quaternion.setFromUnitVectors
   * (Garante alinhamento matemático perfeito nos cabos estaiados da ponte!)
   */
  addCable(key, thickness, x1, y1, z1, x2, y2, z2) {
    const list = this.buckets.get(key);
    if (!list) return;
    const p1 = new THREE.Vector3(x1, y1, z1);
    const p2 = new THREE.Vector3(x2, y2, z2);
    const diff = new THREE.Vector3().subVectors(p2, p1);
    const len = diff.length();
    if (len < 0.001) return;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      diff.normalize()
    );
    const g = new THREE.BoxGeometry(thickness, len, thickness);
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    list.push(g);
  }

  addCylinder(key, rTop, rBottom, h, x, y, z, segs = 10, rx = 0, rz = 0) {
    const list = this.buckets.get(key);
    if (!list) return;
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
    if (rx !== 0 || rz !== 0) {
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz));
      g.applyMatrix4(m);
    }
    g.translate(x, y, z);
    list.push(g);
  }

  flush(scene) {
    flushSpatialChunkedBuckets(scene, this.buckets, this.materials, {
      chunkSize: 768,
      castShadowFn: (key) => this.castShadowKeys.has(key),
      receiveShadowFn: () => true
    });
    this.buckets.clear();
  }
}

export function createInitialPrisonIslandData() {
  const bx = ws(1375);
  const zStart = IS_SCALED_WORLD ? ws(734) : 735;
  const zEnd = IS_SCALED_WORLD ? ws(1122) : 1125;
  return {
    bridgeAlignedWithPort: true,
    bridgeCenterX: bx,
    bridgeStartZ: zStart,
    bridgeEndZ: zEnd,
    bridgeLength: zEnd - zStart,
    bridgeLanes: 4,
    bridgeConcretePillarsCount: 0,
    bridgeSteelTowersCount: 2,
    bridgeTowerHeight: 94,
    bridgeStayCablesCount: 0,
    bridgeStayCablesFixedOrientation: true,
    bopeCheckpointsCount: 2,
    islandWidth: IS_SCALED_WORLD ? ws(842) : 840,
    islandDepth: IS_SCALED_WORLD ? ws(864) : 860,
    coastalRocksCount: 0,
    hasExternalCoastGuardDock: true,
    coastGuardSpeedboatsCount: 2,
    perimeterWallHeight: 40,
    hasMonumentalArmoredGate: true,
    hasSalliePortDoubleGate: true,
    watchtowersCount: 0,
    watchtowerHeight: 68,
    hasCentralCommandTower: true,
    centralTowerHeight: 126,
    hasPoliceHelipad: true,
    helipadsCount: 2,
    bopeHelicoptersOnCitadelCount: 2,
    skybridgesCount: 4,
    skybridgeElevation: 40,
    detentionPavilionsCount: 6,
    pavilionHeights: [82, 66, 66, 58, 58, 60],
    omegaContainmentHeight: 82,
    energyContainmentCellsCount: 0,
    visibleGroundCellsCount: 0,
    prisonersInCellsCount: 0,
    orangePrisonersCount: 0,
    cvPrisonersCount: 0,
    pccPrisonersCount: 0,
    aresPrisonersCount: 0,
    guardsCount: 0,
    elevatedGuardCatwalksCount: 0,
    hasSportsCourt: true,
    sportsCourtsCount: 2,
    hasConcreteBleachers: true,
    weightBenchesCount: 0,
    cafeteriaTablesCount: 0,
    armoredPrisonBusesCount: 0,
    substationTransformersCount: 0,
    dieselGeneratorsCount: 0,
    powerCoilsCount: 0,
    powerTowersCount: 0,
    waterTowersCount: 0
  };
}

/**
 * Cria placas luminosas táticas no estilo IDV Oficial (Preto Asfalto + Amarelo Alerta / Vermelho Alerta)
 */
export function addPrisonBannerSign(
  world,
  x,
  y,
  z,
  width,
  height,
  text,
  subText = '',
  rotY = 0,
  borderColor = '#facc15',
  textColor = '#facc15'
) {
  const signMesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: 1.1,
    rotY,
    title: text,
    subText,
    bgColor: '#090a0d',
    borderColor,
    textColor,
    subColor: '#f8fafc',
    doubleSided: true
  });
  world.scene.add(signMesh);
}

/**
 * Constrói uma Minifigura LEGO 3D articulada estática direto no Batcher (0 Draw Calls extras!):
 * - preset: 'prisoner_orange' | 'prisoner_cv' | 'prisoner_pcc' | 'prisoner_ares' | 'bope_guard' | 'warden_police'
 */
export function addBatchedLegoPerson(batcher, x, y, z, rotY = 0, preset = 'prisoner_orange', pose = 'stand') {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const toWorld = (lx, ly, lz) => [
    x + lx * cos + lz * sin,
    y + ly,
    z - lx * sin + lz * cos
  ];

  let torsoKey = 'prison_orange';
  let legsKey = 'prison_orange';
  let hatKey = null;
  let hasRifle = false;
  let hasBarbell = false;

  if (preset === 'prisoner_cv') {
    torsoKey = 'cv_red';
    legsKey = 'matte_black';
    hatKey = 'cv_red';
  } else if (preset === 'prisoner_pcc') {
    torsoKey = 'pcc_navy';
    legsKey = 'matte_black';
    hatKey = 'matte_black';
  } else if (preset === 'prisoner_ares') {
    torsoKey = 'ares_purple';
    legsKey = 'dark_steel';
    hatKey = 'brushed_silver';
  } else if (preset === 'bope_guard') {
    torsoKey = 'bope_black';
    legsKey = 'matte_black';
    hatKey = 'bope_black';
    hasRifle = true;
  } else if (preset === 'warden_police') {
    torsoKey = 'police_blue';
    legsKey = 'matte_black';
    hatKey = 'tactical_white';
    hasRifle = true;
  }

  if (pose === 'bench_press') {
    hasBarbell = true;
  }

  // Pernas e quadril LEGO
  const [lx1, ly1, lz1] = toWorld(-0.22, 0.42, 0);
  const [lx2, ly2, lz2] = toWorld(0.22, 0.42, 0);
  batcher.addBox(legsKey, 0.36, 0.84, 0.42, lx1, ly1, lz1, 0, rotY, 0);
  batcher.addBox(legsKey, 0.36, 0.84, 0.42, lx2, ly2, lz2, 0, rotY, 0);

  // Tronco LEGO + Colete/Faixa
  const [tx, ty, tz] = toWorld(0, 1.24, 0);
  batcher.addBox(torsoKey, 0.92, 0.88, 0.48, tx, ty, tz, 0, rotY, 0);
  if (preset === 'bope_guard' || preset === 'warden_police') {
    const [vx, vy, vz] = toWorld(0, 1.26, 0.04);
    batcher.addBox('alert_yellow', 0.64, 0.24, 0.52, vx, vy, vz, 0, rotY, 0);
  } else if (preset === 'prisoner_orange') {
    const [sx, sy, sz] = toWorld(0, 1.32, 0.02);
    batcher.addBox('tactical_white', 0.72, 0.18, 0.5, sx, sy, sz, 0, rotY, 0);
  } else if (preset === 'prisoner_ares') {
    const [sx, sy, sz] = toWorld(0, 1.28, 0.04);
    batcher.addBox('laser_cyan', 0.56, 0.24, 0.52, sx, sy, sz, 0, rotY, 0);
  }

  // Braços e Mãos Amarelas LEGO
  const armElevation = pose === 'hands_bars' || pose === 'bench_press' ? 0.22 : 0;
  const armForward = pose === 'hands_bars' ? 0.26 : hasRifle ? 0.18 : 0;
  const [ax1, ay1, az1] = toWorld(-0.62, 1.22 + armElevation, armForward);
  const [ax2, ay2, az2] = toWorld(0.62, 1.22 + armElevation, armForward);
  batcher.addBox(torsoKey, 0.28, 0.74, 0.32, ax1, ay1, az1, 0, rotY, 0);
  batcher.addBox(torsoKey, 0.28, 0.74, 0.32, ax2, ay2, az2, 0, rotY, 0);

  const [hx1, hy1, hz1] = toWorld(-0.62, 0.82 + armElevation, armForward + 0.08);
  const [hx2, hy2, hz2] = toWorld(0.62, 0.82 + armElevation, armForward + 0.08);
  batcher.addBox('lego_skin', 0.24, 0.24, 0.24, hx1, hy1, hz1, 0, rotY, 0);
  batcher.addBox('lego_skin', 0.24, 0.24, 0.24, hx2, hy2, hz2, 0, rotY, 0);

  // Cabeça Cilíndrica LEGO + Pino Superior (Stud)
  const [hdx, hdy, hdz] = toWorld(0, 1.98, 0);
  batcher.addCylinder('lego_skin', 0.34, 0.34, 0.56, hdx, hdy, hdz, 8);
  batcher.addCylinder('lego_skin', 0.18, 0.18, 0.12, hdx, hdy + 0.34, hdz, 8);

  if (hatKey) {
    batcher.addCylinder(hatKey, 0.38, 0.38, 0.26, hdx, hdy + 0.22, hdz, 8);
  }

  if (hasRifle) {
    const [rx, ry, rz] = toWorld(0.35, 1.15, 0.48);
    batcher.addBox('matte_black', 0.16, 0.24, 1.15, rx, ry, rz, 0, rotY, 0);
  }

  if (hasBarbell) {
    const [bx, by, bz] = toWorld(0, 1.65, 0.38);
    batcher.addBox('brushed_silver', 2.2, 0.12, 0.12, bx, by, bz, 0, rotY, 0);
    const [wx1, wy1, wz1] = toWorld(-0.95, 1.65, 0.38);
    const [wx2, wy2, wz2] = toWorld(0.95, 1.65, 0.38);
    batcher.addBox('matte_black', 0.22, 0.65, 0.65, wx1, wy1, wz1, 0, rotY, 0);
    batcher.addBox('matte_black', 0.22, 0.65, 0.65, wx2, wy2, wz2, 0, rotY, 0);
  }
}

/**
 * 1. A GRANDE PONTE BLINDADA (X = ws(1375), Z = zStart..zEnd EM LINHA RETA DO PORTO ATÉ A ILHA DA PRISÃO):
 * - Comprimento escala para cruzar o golfo (pilares a cada ~45.5m reais em 3x), preservando largura (46m),
 *   altura das muretas, guaritas do BOPE e cota Y do tabuleiro em escala 1x;
 * - Cabos de aço estaiados corrigidos com `batcher.addCable(...)` descendo do topo das 2 Torres de 94m
 *   diretamente até a mureta do tabuleiro em Y = 2.4m;
 * - Em `WORLD_SCALE > 1`, registra o tabuleiro em `world.elevatedDecks` e constrói a Via Blindada de Acesso
 *   ligando `zEnd` (`ws(1122)`) até o Portão Monumental Norte da fortaleza (passando por `ilha_prisao.spawn`).
 */
export function buildArmoredCableStayedBridgeAndCheckpoints(world, batcher) {
  const bx = ws(1375);
  const zStart = IS_SCALED_WORLD ? ws(734) : 735;
  const zEnd = IS_SCALED_WORLD ? ws(1122) : 1125;
  const bridgeLen = zEnd - zStart;
  const bridgeMidZ = (zStart + zEnd) * 0.5;
  const deckW = 46;
  const roadW = 34;

  const segCount = IS_SCALED_WORLD ? Math.max(2, Math.round(bridgeLen / 194)) : 1;
  const segLen = bridgeLen / segCount;
  const segPad = IS_SCALED_WORLD ? 0.2 : 0;
  const stripeInset = IS_SCALED_WORLD ? 0.5 : 4;
  for (let s = 0; s < segCount; s++) {
    const sz = zStart + (s + 0.5) * segLen;
    batcher.addBox('gunmetal_concrete', deckW, 2.2, segLen + segPad, bx, -0.82, sz);
    batcher.addBox('matte_black', roadW, 0.12, segLen + segPad, bx, 0.24, sz);
    batcher.addBox('alert_yellow', 0.45, 0.05, segLen - stripeInset, bx - 0.55, 0.31, sz);
    batcher.addBox('alert_yellow', 0.45, 0.05, segLen - stripeInset, bx + 0.55, 0.31, sz);
  }

  if (IS_SCALED_WORLD) {
    if (!world.elevatedDecks) world.elevatedDecks = [];
    const getBridgeDeckY = (_x, z) => (z < zStart + 8 ? 0.3 * Math.max(0, (z - zStart) / 8) : 0.3);
    world.elevatedDecks.push({
      id: 'prison_armored_bridge', minX: bx - deckW * 0.5, maxX: bx + deckW * 0.5, minZ: zStart, maxZ: zEnd,
      topY: 0.3, thresholdBelow: 2.5, getDeckY: getBridgeDeckY, getTopY: getBridgeDeckY
    });
  }

  world.addCollider(bx, bridgeMidZ, deckW, bridgeLen, 0.3, -2.0);
  world.mapRoads.push({ x: bx, z: bridgeMidZ, w: roadW, d: bridgeLen, isMain: true });

  // Pintura Real de 4 Faixas: Linhas Brancas Tracejadas
  for (let zz = zStart + 10; zz <= zEnd - 10; zz += 14) {
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx - 8.5, 0.31, zz);
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx + 8.5, 0.31, zz);
  }

  // Guard-Rails Metálicos Pesados + Passarelas Laterais + Muretas Laterais de Concreto Armado (1x!)
  for (const side of [-1, 1]) {
    const grX = bx + side * 17.6;
    const walkX = bx + side * 20.2;
    const wallX = bx + side * 22.2;
    for (let s = 0; s < segCount; s++) {
      const sz = zStart + (s + 0.5) * segLen;
      batcher.addBox('armor_slate', 4.4, 0.36, segLen + segPad, walkX, 0.46, sz);
      batcher.addBox('brushed_silver', 0.48, 1.15, segLen + segPad, grX, 0.88, sz);
      batcher.addBox('matte_black', 0.55, 0.28, segLen + segPad, grX, 1.35, sz);
      batcher.addBox('gunmetal_concrete', 1.8, 2.4, segLen + segPad, wallX, 1.48, sz);
      batcher.addBox('alert_yellow', 1.9, 0.32, segLen + segPad, wallX, 2.52, sz);
    }
    world.addCollider(wallX, bridgeMidZ, 1.8, bridgeLen, 2.7, 0.28);
  }

  // Pares de Pilares Maciços de Concreto (~45.5m de espaçamento real em 3x; lista original exata em 1x)
  let pillarZList = [768, 814, 860, 906, 954, 1000, 1046, 1092];
  if (IS_SCALED_WORLD) {
    const innerSpan = bridgeLen - 72;
    const intervals = Math.max(2, Math.round(innerSpan / 46));
    pillarZList = Array.from({ length: intervals + 1 }, (_, i) => zStart + 36 + (i * innerSpan) / intervals);
  }

  for (const pz of pillarZList) {
    batcher.addBox('gunmetal_concrete', deckW + 6, 3.2, 6.5, bx, -2.4, pz);
    for (const side of [-1, 1]) {
      const px = bx + side * 18.5;
      batcher.addBox('coastal_rock', 11.5, 3.0, 11.5, px, -2.2, pz);
      batcher.addBox('gunmetal_concrete', 7.8, 5.5, 7.8, px, -1.5, pz);
      batcher.addBox('alert_yellow', 8.2, 0.6, 8.2, px, 0.1, pz);
      world.prisonIslandData.bridgeConcretePillarsCount++;

      const lampX = bx + side * 21.8;
      batcher.addCylinder('dark_steel', 0.28, 0.36, 12.0, lampX, 6.4, pz, 8);
      batcher.addBox('dark_steel', 3.4, 0.32, 0.45, lampX - side * 1.4, 12.2, pz);
      batcher.addBox('searchlight_white', 1.6, 0.24, 0.75, lampX - side * 2.4, 12.0, pz);
    }
  }

  // 2 Torres Gigantes de Aço Estaiadas (H = 94m em 1x!) em Cinza-Chumbo e Amarelo-Alerta
  const towerIdx = Math.max(1, Math.round((pillarZList.length - 1) * 0.29));
  const towerZPositions = !IS_SCALED_WORLD
    ? [860, 1000]
    : [pillarZList[towerIdx], pillarZList[pillarZList.length - 1 - towerIdx]];
  const towerH = 94;
  for (const tz of towerZPositions) {
    for (const side of [-1, 1]) {
      const tx = bx + side * 24.5;
      batcher.addBox('coastal_rock', 16.0, 3.6, 18.0, tx, -1.8, tz);
      batcher.addBox('gunmetal_concrete', 11.0, 18.0, 12.0, tx, 8.5, tz);
      batcher.addBox('dark_steel', 7.6, towerH, 8.6, tx, towerH * 0.5, tz);
      for (const bandY of [18, 36, 54, 72, 88]) {
        batcher.addBox('alert_yellow', 8.2, 2.2, 9.2, tx, bandY, tz);
      }
      batcher.addCylinder('brushed_silver', 0.35, 0.55, 5.0, tx, towerH + 2.5, tz, 8);
      batcher.addBox('siren_red', 1.5, 1.5, 1.5, tx, towerH + 5.4, tz);
      world.addCollider(tx, tz, 9.5, 10.5, towerH + 4, 0);
    }

    // 3 Vigas Transversais Treliçadas Gigantes unindo as 2 colunas acima da pista (Y = 32m, 62m e 90m)
    for (const beamY of [32, 62, 90]) {
      batcher.addBox('dark_steel', 56.0, 4.6, 6.4, bx, beamY, tz);
      batcher.addBox('alert_yellow', 56.6, 0.75, 6.8, bx, beamY - 2.1, tz);
      batcher.addBox('alert_yellow', 56.6, 0.75, 6.8, bx, beamY + 2.1, tz);
    }

    // CABOS DE AÇO GROSSOS ESTAIADOS CORRIGIDOS (Saem do topo da torre em Z=tz, Y=86..71m e descem até o tabuleiro em Z=tz±spanZ, Y=2.4m!)
    const cableSpans = [20, 34, 48, 62, 76];
    for (const side of [-1, 1]) {
      const towerAnchorX = bx + side * 23.2;
      const deckAnchorX = bx + side * 22.0;
      for (const dirZ of [-1, 1]) {
        cableSpans.forEach((spanZ, idx) => {
          const towerAnchorY = 86 - idx * 3.6;
          const towerAnchorZ = tz + dirZ * 2.5;
          const deckAnchorZ = tz + dirZ * spanZ;
          const deckAnchorY = 2.4;
          batcher.addCable('brushed_silver', 0.42, towerAnchorX, towerAnchorY, towerAnchorZ, deckAnchorX, deckAnchorY, deckAnchorZ);
          batcher.addBox('alert_yellow', 0.95, 1.1, 1.2, deckAnchorX, 2.5, deckAnchorZ);
          world.prisonIslandData.bridgeStayCablesCount++;
        });
      }
    }
  }

  // 2 Checkpoints / Bloqueios Policiais Fortificados do BOPE nas duas pontas da Ponte (tamanho 1x!):
  _buildBridgeBopeCheckpoint(world, batcher, bx, IS_SCALED_WORLD ? zStart + 14 : 746, 'CONTROLE PONTE — BOPE (PORTO)', 0);
  _buildBridgeBopeCheckpoint(world, batcher, bx, IS_SCALED_WORLD ? zEnd - 23 : 1102, 'BLOQUEIO PENITENCIÁRIO — BOPE', Math.PI);

  if (IS_SCALED_WORLD && 1125 + PRISON_OFFSET_Z > zEnd + 8) {
    _buildScaledPrisonApproachRoad(world, batcher, bx, zEnd, 1125 + PRISON_OFFSET_Z, roadW);
  }
}

function _buildScaledPrisonApproachRoad(world, batcher, bx, zFrom, zTo, roadW) {
  const len = zTo - zFrom;
  const midZ = (zFrom + zTo) * 0.5;
  const segCount = Math.max(2, Math.round(len / 210));
  const segLen = len / segCount;

  for (let s = 0; s < segCount; s++) {
    const sz = zFrom + (s + 0.5) * segLen;
    batcher.addBox('matte_black', roadW, 0.14, segLen + 0.2, bx, 0.34, sz);
    batcher.addBox('alert_yellow', 0.45, 0.05, segLen - 0.4, bx - 0.55, 0.42, sz);
    batcher.addBox('alert_yellow', 0.45, 0.05, segLen - 0.4, bx + 0.55, 0.42, sz);
    for (const side of [-1, 1]) {
      batcher.addBox('armor_slate', 5.2, 0.18, segLen + 0.2, bx + side * (roadW * 0.5 + 2.6), 0.36, sz);
    }
  }

  for (let zz = zFrom + 12; zz <= zTo - 12; zz += 14) {
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx - 8.5, 0.42, zz);
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx + 8.5, 0.42, zz);
  }

  for (let pz = zFrom + 42; pz <= zTo - 32; pz += 52) {
    for (const side of [-1, 1]) {
      const lampX = bx + side * (roadW * 0.5 + 4.6);
      batcher.addCylinder('dark_steel', 0.28, 0.36, 12.0, lampX, 6.3, pz, 8);
      batcher.addBox('dark_steel', 3.4, 0.32, 0.45, lampX - side * 1.4, 12.1, pz);
      batcher.addBox('searchlight_white', 1.6, 0.24, 0.75, lampX - side * 2.4, 11.9, pz);
      world.addCollider(lampX, pz, 1.0, 1.0, 12.4, 0.28);
    }
  }

  world.mapRoads.push({ x: bx, z: midZ, w: roadW, d: len, isMain: true });
}

/**
 * Constrói 1 Posto de Bloqueio Fortificado / Guarita do BOPE na Ponte
 */
function _buildBridgeBopeCheckpoint(world, batcher, cx, cz, signTitle, facingRotY) {
  for (const side of [-1, 1]) {
    const px = cx + side * 19.5;
    batcher.addBox('bope_black', 3.2, 15.5, 3.6, px, 7.75, cz);
    batcher.addBox('alert_yellow', 3.4, 1.2, 3.8, px, 3.2, cz);
    batcher.addBox('alert_yellow', 3.4, 1.2, 3.8, px, 12.8, cz);

    const gx = cx + side * 15.2;
    const gz = cz + (facingRotY === 0 ? -5.5 : 5.5);
    batcher.addBox('gunmetal_concrete', 5.2, 4.4, 5.8, gx, 2.5, gz);
    batcher.addBox('smoked_glass', 5.4, 1.5, 4.2, gx, 3.1, gz);
    batcher.addBox('bope_black', 6.0, 0.85, 6.6, gx, 4.9, gz);
    batcher.addBox('alert_yellow', 6.1, 0.28, 6.7, gx, 5.35, gz);
    batcher.addBox('siren_red', 0.65, 0.65, 0.65, gx - side * 1.4, 5.65, gz);
    batcher.addBox('siren_blue', 0.65, 0.65, 0.65, gx + side * 1.4, 5.65, gz);
    world.addCollider(gx, gz, 5.2, 5.8, 5.5, 0.28);

    const barX = cx + side * 11.2;
    batcher.addBox('gunmetal_concrete', 4.6, 1.35, 1.6, barX, 0.95, cz);
    batcher.addBox('alert_yellow', 4.7, 0.35, 1.7, barX, 1.45, cz);
    world.addCollider(barX, cz, 4.6, 1.6, 1.8, 0.28);

    const gatePivotX = cx + side * 12.6;
    batcher.addBox('bope_black', 1.1, 1.8, 1.1, gatePivotX, 1.18, cz + 2.2);
    for (let s = 0; s < 4; s++) {
      const segX = gatePivotX - side * (1.2 + s * 1.15);
      batcher.addBox(s % 2 === 0 ? 'cv_red' : 'tactical_white', 1.15, 0.26, 0.26, segX, 1.82, cz + 2.2);
    }

    addBatchedLegoPerson(batcher, cx + side * 10.2, 0.3, cz - 2.6, facingRotY, 'bope_guard', 'stand');
    addBatchedLegoPerson(batcher, cx + side * 14.0, 0.3, cz + 2.8, facingRotY, 'warden_police', 'stand');
    world.prisonIslandData.guardsCount += 2;
  }

  batcher.addBox('bope_black', 42.0, 3.2, 3.8, cx, 15.8, cz);
  batcher.addBox('alert_yellow', 42.4, 0.45, 4.0, cx, 14.2, cz);
  for (const lx of [-14, -6, 6, 14]) {
    batcher.addBox('searchlight_white', 2.4, 0.9, 0.6, cx + lx, 14.0, cz + (facingRotY === 0 ? -2.0 : 2.0));
  }
  addPrisonBannerSign(
    world,
    cx,
    15.9,
    cz + (facingRotY === 0 ? -2.1 : 2.1),
    26.0,
    2.6,
    signTitle,
    'ÁREA DE SEGURANÇA MÁXIMA — REDUZA A VELOCIDADE',
    facingRotY
  );
}
