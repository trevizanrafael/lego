import * as THREE from 'three';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from '../BuildingGenerator.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';

/**
 * Acumulador de Geometrias 3D da Grande Ponte Blindada Estaiada & Ilha da Prisão de Segurança Máxima (2x Maior):
 * Funde milhares de peças LEGO (Ponte, Torres Estaiadas de 94m com Cabos Corrigidos, 2 Checkpoints do BOPE,
 * 140+ Rochas Costeiras, Doca Naval da Guarda Costeira, Muralhas de 40m, 8 Torres de Vigia de 68m,
 * Cidadela Panóptica Central "A Balsa" de 126m com 4 Passarelas Aéreas e Duplo Heliponto,
 * 6 Pavilhões Penitenciários Altos de 58m-82m com Ala Ômega Laser e 24 Celas Térreas Visíveis,
 * e 4 Setores de Pátio 100% Preenchidos com Passarelas Elevadas de Ronda) em ~24 Draw Calls para manter 60 FPS!
 */
class PrisonIslandBatcher {
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
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: opts.roughness ?? 0.36,
          metalness: opts.metalness ?? 0.14,
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
      list.push(makeTranslatedBox(w, h, d, x, y, z));
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
    for (const [key, geos] of this.buckets.entries()) {
      if (geos.length === 0) continue;
      const merged = mergeBufferGeometries(geos);
      const mesh = new THREE.Mesh(merged, this.materials.get(key));
      mesh.receiveShadow = true;
      mesh.castShadow = this.castShadowKeys.has(key);
      scene.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.buckets.clear();
  }
}

/**
 * Cria placas luminosas táticas no estilo IDV Oficial (Preto Asfalto + Amarelo Alerta / Vermelho Alerta)
 */
function _addPrisonBannerSign(world, x, y, z, width, height, text, subText = '', rotY = 0, borderColor = '#facc15', textColor = '#facc15') {
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
function _addBatchedLegoPerson(batcher, x, y, z, rotY = 0, preset = 'prisoner_orange', pose = 'stand') {
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
 * 9. SUDESTE — GRANDE PONTE BLINDADA ESTAIADA (COM CABOS CORRIGIDOS)
 * + ILHA DA PRISÃO DE SEGURANÇA MÁXIMA 2X MAIOR (840m x 860m, ESTILO ALCATRAZ / A BALSA)
 */
export function buildSoutheastPrisonIsland(world) {
  const batcher = new PrisonIslandBatcher();

  world.prisonIslandData = {
    bridgeAlignedWithPort: true,
    bridgeCenterX: 1375,
    bridgeStartZ: 735,
    bridgeEndZ: 1125,
    bridgeLength: 390,
    bridgeLanes: 4,
    bridgeConcretePillarsCount: 0,
    bridgeSteelTowersCount: 2,
    bridgeTowerHeight: 94,
    bridgeStayCablesCount: 0,
    bridgeStayCablesFixedOrientation: true,
    bopeCheckpointsCount: 2,
    islandWidth: 840,
    islandDepth: 860,
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

  // 1. A GRANDE PONTE BLINDADA ESTAIADA (X = 1375, Z = 735..1125) COM CABOS CORRIGIDOS + 2 CHECKPOINTS DO BOPE
  _buildArmoredCableStayedBridgeAndCheckpoints(world, batcher);

  // 2. ILHA DA PRISÃO 2X MAIOR (840m x 860m), ROCHAS COSTEIRAS, DOCA NAVAL DA GUARDA COSTEIRA, MURALHA DE 40m E 8 TORRES DE VIGIA (68m)
  _buildPrisonIslandPerimeterWallsAndCoastGuardDock(world, batcher);

  // 3. A CIDADELA PANÓPTICA CENTRAL ("A BALSA" — 126m DE ALTURA, 4 PASSARELAS AÉREAS EM Y=40m E DUPLO HELIPONTO)
  _buildCentralPanopticonCitadelAndSkybridges(world, batcher);

  // 4. OS 6 PAVILHÕES PENITENCIÁRIOS ALTOS (58m A 82m) COM ALA ÔMEGA LASER E CELAS TÉRREAS VISÍVEIS
  _buildSixTallPenitentiaryPavilions(world, batcher);

  // 5. OS 4 SETORES INTERNOS DO PÁTIO 100% PREENCHIDOS (ALAMBRADOS DUPLOS + PASSARELAS ELEVADAS DE RONDA)
  _buildFourInternalCourtyardSectors(world, batcher);

  batcher.flush(world.scene);
}

/**
 * 1. A GRANDE PONTE BLINDADA (X = 1375, Z = 735..1125 — 390m EM LINHA RETA DO PORTO ATÉ A ILHA DA PRISÃO):
 * - Cabos de aço estaiados corrigidos com `batcher.addCable(...)` descendo do topo das 2 Torres de 94m
 *   diretamente até a mureta do tabuleiro em Y = 2.2m (nunca de cabeça para baixo!);
 * - 2 Checkpoints / Bloqueios Policiais do BOPE nas duas pontas da ponte (Porto Z=746 e Prisão Z=1102).
 */
function _buildArmoredCableStayedBridgeAndCheckpoints(world, batcher) {
  const bx = 1375;
  const zStart = 735;
  const zEnd = 1125;
  const bridgeLen = zEnd - zStart; // 390m
  const bridgeMidZ = (zStart + zEnd) * 0.5; // 930
  const deckW = 46;
  const roadW = 34;

  // Tabuleiro Estrutural Blindado
  batcher.addBox('gunmetal_concrete', deckW, 2.2, bridgeLen, bx, -0.82, bridgeMidZ);
  batcher.addBox('matte_black', roadW, 0.12, bridgeLen, bx, 0.24, bridgeMidZ);
  world.addCollider(bx, bridgeMidZ, deckW, bridgeLen, 0.3, -2.0);
  world.mapRoads.push({ x: bx, z: bridgeMidZ, w: roadW, d: bridgeLen, isMain: true });

  // Pintura Real de 4 Faixas: Faixa Dupla Amarela Central + Linhas Brancas Tracejadas
  batcher.addBox('alert_yellow', 0.45, 0.05, bridgeLen - 4, bx - 0.55, 0.31, bridgeMidZ);
  batcher.addBox('alert_yellow', 0.45, 0.05, bridgeLen - 4, bx + 0.55, 0.31, bridgeMidZ);
  for (let zz = zStart + 10; zz <= zEnd - 10; zz += 14) {
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx - 8.5, 0.31, zz);
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx + 8.5, 0.31, zz);
  }

  // Guard-Rails Metálicos Pesados + Passarelas Laterais + Muretas Laterais de Concreto Armado
  for (const side of [-1, 1]) {
    const grX = bx + side * 17.6;
    const walkX = bx + side * 20.2;
    const wallX = bx + side * 22.2;

    batcher.addBox('armor_slate', 4.4, 0.36, bridgeLen, walkX, 0.46, bridgeMidZ);
    batcher.addBox('brushed_silver', 0.48, 1.15, bridgeLen, grX, 0.88, bridgeMidZ);
    batcher.addBox('matte_black', 0.55, 0.28, bridgeLen, grX, 1.35, bridgeMidZ);

    batcher.addBox('gunmetal_concrete', 1.8, 2.4, bridgeLen, wallX, 1.48, bridgeMidZ);
    batcher.addBox('alert_yellow', 1.9, 0.32, bridgeLen, wallX, 2.52, bridgeMidZ);
    world.addCollider(wallX, bridgeMidZ, 1.8, bridgeLen, 2.7, 0.28);
  }

  // 8 Pares de Pilares Maciços de Concreto Sustentando o Tabuleiro até o Oceano + Iluminação Dupla
  const pillarZList = [768, 814, 860, 906, 954, 1000, 1046, 1092];
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

  // 2 Torres Gigantes de Aço Estaiadas (H = 94m!) em Cinza-Chumbo e Amarelo-Alerta (Z = 860 e Z = 1000)
  const towerZPositions = [860, 1000];
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
          batcher.addCable(
            'brushed_silver',
            0.42,
            towerAnchorX,
            towerAnchorY,
            towerAnchorZ,
            deckAnchorX,
            deckAnchorY,
            deckAnchorZ
          );
          // Bloco de ancoragem amarelo-alerta na mureta da ponte onde o cabo chega
          batcher.addBox('alert_yellow', 0.95, 1.1, 1.2, deckAnchorX, 2.5, deckAnchorZ);
          world.prisonIslandData.bridgeStayCablesCount++;
        });
      }
    }
  }

  // 2 Checkpoints / Bloqueios Policiais Fortificados do BOPE nas duas pontas da Ponte:
  _buildBridgeBopeCheckpoint(world, batcher, bx, 746, 'CONTROLE PONTE — BOPE (PORTO)', 0);
  _buildBridgeBopeCheckpoint(world, batcher, bx, 1102, 'BLOQUEIO PENITENCIÁRIO — BOPE', Math.PI);
}

/**
 * Constrói 1 Posto de Bloqueio Fortificado do BOPE na Ponte
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

    _addBatchedLegoPerson(batcher, cx + side * 10.2, 0.3, cz - 2.6, facingRotY, 'bope_guard', 'stand');
    _addBatchedLegoPerson(batcher, cx + side * 14.0, 0.3, cz + 2.8, facingRotY, 'warden_police', 'stand');
    world.prisonIslandData.guardsCount += 2;
  }

  batcher.addBox('bope_black', 42.0, 3.2, 3.8, cx, 15.8, cz);
  batcher.addBox('alert_yellow', 42.4, 0.45, 4.0, cx, 14.2, cz);
  for (const lx of [-14, -6, 6, 14]) {
    batcher.addBox('searchlight_white', 2.4, 0.9, 0.6, cx + lx, 14.0, cz + (facingRotY === 0 ? -2.0 : 2.0));
  }
  _addPrisonBannerSign(
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

/**
 * 2. ESCALA 2X MAIOR DA ILHA DA PRISÃO (840m x 860m) + BORDA ROCHOSA + DOCA NAVAL EXTERNA DA GUARDA COSTEIRA:
 * - Ilha-Fortaleza Federal (X = 955..1795, Z = 1120..1980, centro X = 1375, Z = 1550) com mais de 2x a área anterior;
 * - Borda Costeira Rochosa & Quebra-Mar de LEGO cercando toda a base externa na água;
 * - Doca Naval da Guarda Costeira fora da Muralha Oeste (X = 860..995, Z = 1505..1595) ligada à muralha por
 *   Portão Lateral Blindado, com Guindaste Naval de 38m, caixas de suprimentos e 2 Lanchas Blindadas da Polícia Marítima;
 * - Muralha Perimetral Colossal de 40m (X = 995..1755, Z = 1125..1935) + 8 Torres de Vigia de 68m!
 */
function _buildPrisonIslandPerimeterWallsAndCoastGuardDock(world, batcher) {
  const ix = 1375;
  const iz = 1550;
  const islandW = 840; // X = 955..1795
  const islandD = 860; // Z = 1120..1980

  // Base Rochosa Costeira Escura + Plataforma Continental de Concreto Pesado da Ilha
  batcher.addBox('coastal_rock', islandW + 32, 2.4, islandD + 32, ix, -0.85, iz);
  batcher.addBox('yard_concrete', islandW, 1.1, islandD, ix, -0.25, iz);
  world.addCollider(ix, iz, islandW, islandD, 0.3, -2.5);
  world.mapBlocks.push({ x: ix, z: iz, w: islandW, d: islandD, color: '#334155' });

  // Anel de Rochas Costeiras / Quebra-Mar de Pedra Escura no Oceano cercando toda a Ilha 2x Maior
  for (let rx = 940; rx <= 1810; rx += 26) {
    for (const rz of [1104, 1994]) {
      if (rz === 1104 && Math.abs(rx - ix) < 36) continue; // Deixa livre a chegada da Ponte Blindada
      const rw = 18 + ((rx * 7) % 14);
      const rh = 3.6 + ((rx * 13) % 6);
      const rd = 16 + ((rx * 11) % 12);
      batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
      batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
      world.prisonIslandData.coastalRocksCount++;
    }
  }
  for (let rz = 1125; rz <= 1975; rz += 26) {
    for (const rx of [940, 1810]) {
      // Deixa abertura na frente da Doca Naval da Guarda Costeira a Oeste (X=940, Z=1500..1600)
      if (rx === 940 && rz >= 1495 && rz <= 1605) continue;
      const rw = 16 + ((rz * 9) % 12);
      const rh = 3.8 + ((rz * 17) % 6);
      const rd = 18 + ((rz * 7) % 14);
      batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
      batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
      world.prisonIslandData.coastalRocksCount++;
    }
  }

  // ==========================================================================
  // DOCA NAVAL DA GUARDA COSTEIRA (FORA DA MURALHA OESTE: X = 860..995, Z = 1505..1595)
  // ==========================================================================
  const dockX = 928;
  const dockZ = 1550;
  const dockW = 136; // X = 860..996
  const dockD = 90;  // Z = 1505..1595
  batcher.addBox('gunmetal_concrete', dockW, 2.2, dockD, dockX, -0.82, dockZ);
  batcher.addBox('armor_slate', dockW - 4, 0.16, dockD - 4, dockX, 0.32, dockZ);
  world.addCollider(dockX, dockZ, dockW, dockD, 0.3, -2.5);
  world.mapBlocks.push({ x: dockX, z: dockZ, w: dockW, d: dockD, color: '#1e293b' });

  // Faixas Zebradas Amarelas/Pretas na borda marítima Oeste (X = 862), Cabeços de Amarração e Defensas de Borracha
  batcher.addBox('alert_yellow', 2.4, 0.12, dockD - 2, 862.5, 0.41, dockZ);
  for (let dz = 1512; dz <= 1588; dz += 12) {
    batcher.addBox('matte_black', 2.5, 0.14, 4.5, 862.5, 0.42, dz);
    batcher.addBox('matte_black', 1.4, 1.8, 3.2, 859.6, -0.2, dz);
    batcher.addCylinder('dark_steel', 0.55, 0.72, 1.3, 864.8, 0.95, dz, 8);
  }

  // 2 Dedos de Atracação (Píeres Flutuantes em X = 842..860) onde as 2 Lanchas Blindadas da Polícia Marítima ficam atracadas!
  for (const pierZ of [1516, 1550, 1584]) {
    batcher.addBox('gunmetal_concrete', 24, 1.4, 4.8, 848, -0.35, pierZ);
    batcher.addBox('alert_yellow', 24.2, 0.18, 5.0, 848, 0.42, pierZ);
    world.addCollider(848, pierZ, 24, 4.8, 0.3, -1.5);
  }

  // Guindaste Naval da Guarda Costeira (H = 38m em X = 885, Z = 1518) + Contêineres e Caixas de Suprimentos do BOPE
  batcher.addBox('alert_yellow', 10, 4.5, 10, 885, 2.5, 1518);
  batcher.addBox('dark_steel', 4.5, 34.0, 4.5, 885, 19.5, 1518);
  batcher.addBox('alert_yellow', 32.0, 3.2, 3.2, 874, 35.5, 1518);
  batcher.addCable('matte_black', 0.32, 862, 34.0, 1518, 862, 10.0, 1518);
  batcher.addBox('police_blue', 6.5, 3.8, 4.2, 862, 8.2, 1518);
  world.addCollider(885, 1518, 10, 10, 38, 0.28);

  // Caixas de Suprimentos Táticos e Combustível Naval no Píer + Policiais da Guarda Costeira
  for (let cx = 905; cx <= 955; cx += 16) {
    batcher.addBox('police_blue', 8.5, 4.2, 5.5, cx, 2.4, 1520);
    batcher.addBox('alert_yellow', 8.7, 0.45, 5.7, cx, 4.55, 1520);
    batcher.addBox('gunmetal_concrete', 7.5, 3.6, 5.0, cx, 2.1, 1580);
    world.addCollider(cx, 1520, 8.5, 5.5, 4.6, 0.28);
    world.addCollider(cx, 1580, 7.5, 5.0, 3.8, 0.28);
  }
  _addBatchedLegoPerson(batcher, 872, 0.42, 1535, -Math.PI / 2, 'bope_guard', 'stand');
  _addBatchedLegoPerson(batcher, 872, 0.42, 1565, -Math.PI / 2, 'warden_police', 'stand');
  _addBatchedLegoPerson(batcher, 945, 0.42, 1550, 0, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount += 3;

  // ==========================================================================
  // MURALHA PERIMETRAL COLOSSAL (H = 40m, X = 995..1755, Z = 1125..1935 — 760m x 810m!)
  // ==========================================================================
  const wallH = 40;
  const wallThick = 14;
  const minX = 995;
  const maxX = 1755;
  const minZ = 1125;
  const maxZ = 1935;
  const spanX = maxX - minX; // 760m
  const spanZ = maxZ - minZ; // 810m

  // Muralha Sul (Z = 1935) e Muralha Leste (X = 1755)
  _buildFortifiedWallSegment(world, batcher, ix, maxZ, spanX, wallThick, wallH, true);
  _buildFortifiedWallSegment(world, batcher, maxX, (minZ + maxZ) * 0.5, wallThick, spanZ, wallH, false);

  // Muralha Oeste (X = 995) dividida em 2 trechos com Portão Lateral Blindado (Z = 1550) para a Doca Naval!
  _buildFortifiedWallSegment(world, batcher, minX, 1325, wallThick, 400, wallH, false); // Z = 1125..1525
  _buildFortifiedWallSegment(world, batcher, minX, 1755, wallThick, 360, wallH, false); // Z = 1575..1935
  // Sobreportão e Pórtico Blindado do Portão Lateral Naval (X = 995, Z = 1550, vão livre Z = 1536..1564)
  batcher.addBox('gunmetal_concrete', 16, 22, 54, minX, 29.3, 1550);
  batcher.addBox('alert_yellow', 17, 1.0, 55, minX, 18.2, 1550);
  _addPrisonBannerSign(
    world,
    minX - 8.5,
    26.0,
    1550,
    42.0,
    5.0,
    'DOCA NAVAL — GUARDA COSTEIRA',
    'ACESSO MARÍTIMO BLINDADO • BOPE / POLÍCIA FEDERAL',
    -Math.PI / 2
  );

  // Muralha Norte (Z = 1125) dividida em 2 alas laterais para o Portão Blindado Monumental (X = 1375)
  _buildFortifiedWallSegment(world, batcher, 1161, minZ, 332, wallThick, wallH, true); // X = 995..1327
  _buildFortifiedWallSegment(world, batcher, 1589, minZ, 332, wallThick, wallH, true); // X = 1423..1755

  // PORTÃO BLINDADO MONUMENTAL NORTE (X = 1375, Z = 1125)
  batcher.addBox('gunmetal_concrete', 96, 24, 16, ix, 30.3, minZ);
  batcher.addBox('bope_black', 98, 4.2, 17.5, ix, 41.2, minZ);
  batcher.addBox('alert_yellow', 98.5, 0.9, 18.0, ix, 18.6, minZ);
  batcher.addBox('alert_yellow', 98.5, 0.9, 18.0, ix, 43.0, minZ);

  for (const side of [-1, 1]) {
    const pillarX = ix + side * 22;
    batcher.addBox('dark_steel', 16, 18.5, 15, pillarX, 9.5, minZ);
    world.addCollider(pillarX, minZ, 16, 15, 42, 0.28);
    for (let bar = 0; bar < 5; bar++) {
      const bxBar = ix + side * (12.8 + bar * 1.1);
      batcher.addCylinder('brushed_silver', 0.28, 0.28, 18.0, bxBar, 9.3, minZ, 8);
    }
  }
  for (let gx = ix - 12; gx <= ix + 12; gx += 2.4) {
    batcher.addCylinder('brushed_silver', 0.26, 0.26, 9.5, gx, 23.5, minZ, 8);
  }

  _addPrisonBannerSign(
    world,
    ix,
    32.5,
    minZ - 8.4,
    68.0,
    7.2,
    'PENITENCIÁRIA DE SEGURANÇA MÁXIMA',
    'COMPLEXO FEDERAL "A BALSA" — FORÇA TÁTICA / BOPE',
    0,
    '#ef4444',
    '#facc15'
  );
  _addPrisonBannerSign(
    world,
    ix,
    32.5,
    minZ + 8.4,
    58.0,
    6.2,
    'SAÍDA CONTROLADA — PONTE BLINDADA',
    'PORTÃO DUPLO DE CONTENÇÃO (SALLIE PORT)',
    Math.PI,
    '#facc15',
    '#facc15'
  );

  // 8 TORRES DE VIGIA GIGANTES (H = 68m — 4 esquinas + 2 laterais do Portão Principal + 2 laterais centrais!)
  const watchtowerCoords = [
    { x: minX, z: minZ, label: 'TORRE DE VIGIA NOROESTE' },
    { x: maxX, z: minZ, label: 'TORRE DE VIGIA NORDESTE' },
    { x: minX, z: maxZ, label: 'TORRE DE VIGIA SUDOESTE' },
    { x: maxX, z: maxZ, label: 'TORRE DE VIGIA SUDESTE' },
    { x: ix - 46, z: minZ, label: 'TORRE DO PORTÃO OESTE' },
    { x: ix + 46, z: minZ, label: 'TORRE DO PORTÃO LESTE' },
    { x: minX, z: 1515, label: 'TORRE DE VIGIA DOCA NAVAL' },
    { x: maxX, z: 1540, label: 'TORRE DE VIGIA LESTE' }
  ];

  for (const wt of watchtowerCoords) {
    _buildGiantWatchtower(world, batcher, wt.x, wt.z, 68, wt.label);
  }
}

function _buildFortifiedWallSegment(world, batcher, x, z, w, d, h, isHorizontal) {
  batcher.addBox('gunmetal_concrete', w, h, d, x, 0.28 + h * 0.5, z);
  batcher.addBox('armor_slate', w + 2.4, 1.2, d + 2.4, x, 0.28 + h + 0.6, z);
  if (isHorizontal) {
    batcher.addBox('chainlink_mesh', w, 3.8, 0.35, x, 0.28 + h + 3.1, z - d * 0.5 - 0.8);
    batcher.addBox('chainlink_mesh', w, 3.8, 0.35, x, 0.28 + h + 3.1, z + d * 0.5 + 0.8);
    for (let xx = x - w * 0.5 + 20; xx <= x + w * 0.5 - 20; xx += 36) {
      batcher.addBox('dark_steel', 4.4, h - 2, d + 3.2, xx, 0.28 + (h - 2) * 0.5, z);
      batcher.addBox('alert_yellow', 14.0, 2.2, d + 0.8, xx, 1.4, z);
    }
  } else {
    batcher.addBox('chainlink_mesh', 0.35, 3.8, d, x - w * 0.5 - 0.8, 0.28 + h + 3.1, z);
    batcher.addBox('chainlink_mesh', 0.35, 3.8, d, x + w * 0.5 + 0.8, 0.28 + h + 3.1, z);
    for (let zz = z - d * 0.5 + 20; zz <= z + d * 0.5 - 20; zz += 36) {
      batcher.addBox('dark_steel', w + 3.2, h - 2, 4.4, x, 0.28 + (h - 2) * 0.5, zz);
      batcher.addBox('alert_yellow', w + 0.8, 2.2, 14.0, x, 1.4, zz);
    }
  }
  world.addCollider(x, z, w, d, h + 2, 0.28);
}

function _buildGiantWatchtower(world, batcher, x, z, h, label) {
  batcher.addBox('bope_black', 22, 18, 22, x, 9.2, z);
  batcher.addBox('dark_steel', 16, h - 14, 16, x, 0.28 + (h - 14) * 0.5, z);
  for (const bandY of [18, 34, 50]) {
    batcher.addBox('alert_yellow', 17.2, 1.8, 17.2, x, bandY, z);
  }
  const deckY = h - 12;
  batcher.addBox('gunmetal_concrete', 25, 2.2, 25, x, deckY, z);
  batcher.addBox('alert_yellow', 25.6, 0.65, 25.6, x, deckY + 1.2, z);
  batcher.addCylinder('bope_black', 10.5, 10.5, 8.5, x, deckY + 5.2, z, 8);
  batcher.addCylinder('smoked_glass', 10.8, 10.8, 4.2, x, deckY + 5.6, z, 8);
  batcher.addCylinder('dark_steel', 12.2, 12.2, 1.8, x, deckY + 9.8, z, 8);
  batcher.addCylinder('brushed_silver', 0.35, 0.5, 6.5, x, h + 1.5, z, 8);
  batcher.addBox('siren_red', 1.6, 1.6, 1.6, x, h + 5.0, z);
  batcher.addBox('searchlight_white', 2.6, 1.8, 2.6, x, deckY + 2.4, z);
  const dirX = x < 1375 ? 1 : -1;
  const dirZ = z < 1540 ? 1 : -1;
  batcher.addCylinder(
    'searchlight_beam',
    1.2,
    8.5,
    28.0,
    x + dirX * 8,
    deckY - 10,
    z + dirZ * 8,
    10,
    dirZ * 0.45,
    -dirX * 0.45
  );
  _addBatchedLegoPerson(batcher, x + dirX * 9.2, deckY + 1.2, z, dirX > 0 ? Math.PI / 2 : -Math.PI / 2, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount++;
  world.prisonIslandData.watchtowersCount++;
  world.addCollider(x, z, 22, 22, h, 0.28);
  world.mapBuildings.push({ x, z, w: 22, d: 22, height: h, color: '#0f172a', label });
}

/**
 * 3. A CIDADELA PANÓPTICA CENTRAL ("A BALSA" — X = 1375, Z = 1540, H = 126m! DENTRO DE 110..135m):
 * - Fortaleza-Torre Panóptica Colossal no centro exato da ilha em concreto preto fosco e aço cinza-chumbo
 *   com faixas amarelo-alerta e janelas blindadas azuis;
 * - 4 Passarelas Aéreas Blindadas (Skybridges em Y = 40m, dentro de 35..45m) saindo em cruz (Norte, Sul, Leste, Oeste)
 *   conectando a Cidadela diretamente aos Pavilhões de Detenção ao redor;
 * - Topo da Cidadela (Y = 126.5m) com Duplo Heliponto Policial (2 plataformas "H" em X=1352 e X=1398),
 *   2 Helicópteros do BOPE estacionados, antenas de comunicação, sirenes e radar giratório!
 */
function _buildCentralPanopticonCitadelAndSkybridges(world, batcher) {
  const cx = 1375;
  const cz = 1540;
  const towerH = 126; // 110..135 unidades de altura!

  // 1. Base Blindada Octogonal/Quadrada Larga da Cidadela (112m x 112m x 36m) com Contrafortes de Aço
  batcher.addBox('bope_black', 112, 36, 112, cx, 18.28, cz);
  batcher.addBox('gunmetal_concrete', 104, 38, 104, cx, 19.28, cz);
  batcher.addBox('alert_yellow', 113, 1.4, 113, cx, 36.2, cz);

  // 2. Corpo Principal da Cidadela Panóptica (84m x 84m, de Y = 36m até Y = 98m)
  batcher.addBox('gunmetal_concrete', 84, 62, 84, cx, 67.0, cz);
  for (const cOffX of [-40, 40]) {
    for (const cOffZ of [-40, 40]) {
      batcher.addBox('dark_steel', 12, 98, 12, cx + cOffX, 49.28, cz + cOffZ);
    }
  }

  // Faixas Amarelo-Alerta e Dezenas de Janelas Blindadas Azuis Luminosas em Todos os Andares da Cidadela
  for (let floorY = 14; floorY <= 92; floorY += 10) {
    const span = floorY < 36 ? 106 : 86;
    batcher.addBox('smoked_glass', span, 3.4, span, cx, floorY, cz);
    if (floorY % 20 === 14) {
      batcher.addBox('alert_yellow', span + 1.2, 1.1, span + 1.2, cx, floorY - 3.2, cz);
    }
  }

  // 3. Coroa Panóptica de Comando 360° (Y = 98m..126m — 92m x 92m com Mirante de Vidro Blindado Azul)
  batcher.addBox('bope_black', 92, 28, 92, cx, 112.0, cz);
  batcher.addBox('smoked_glass', 94, 8.5, 94, cx, 108.0, cz);
  batcher.addBox('smoked_glass', 94, 6.5, 94, cx, 119.5, cz);
  batcher.addBox('alert_yellow', 95, 1.4, 95, cx, 98.5, cz);
  batcher.addBox('alert_yellow', 95, 1.4, 95, cx, 125.8, cz);

  // 4. Terraço de Comando Superior (Y = 126.28m) + DUPLO HELIPONTO POLICIAL (X = 1352 e X = 1398, Z = 1540)
  const roofY = 0.28 + towerH; // 126.28m
  batcher.addBox('armor_slate', 90, 0.5, 90, cx, roofY, cz);

  for (const heliX of [1352, 1398]) {
    batcher.addCylinder('matte_black', 17.5, 17.5, 0.36, heliX, roofY + 0.32, cz, 24);
    batcher.addCylinder('alert_yellow', 15.8, 15.8, 0.38, heliX, roofY + 0.34, cz, 24);
    batcher.addCylinder('matte_black', 14.2, 14.2, 0.40, heliX, roofY + 0.36, cz, 24);
    // Letra "H" Branca em cada Heliponto Policial
    batcher.addBox('tactical_white', 2.0, 0.12, 12.0, heliX - 4.0, roofY + 0.46, cz);
    batcher.addBox('tactical_white', 2.0, 0.12, 12.0, heliX + 4.0, roofY + 0.46, cz);
    batcher.addBox('tactical_white', 8.0, 0.12, 2.0, heliX, roofY + 0.46, cz);
  }

  // Torre de Radar Giratório, Antenas de Comunicação e Sirenes no Topo Norte/Sul da Cidadela (Y = 126.5..142m)
  batcher.addBox('dark_steel', 18, 8.5, 12, cx, roofY + 4.2, cz - 34);
  batcher.addCylinder('brushed_silver', 0.8, 1.1, 12.0, cx, roofY + 14.0, cz - 34, 8);
  batcher.addBox('alert_yellow', 12.0, 2.2, 1.4, cx, roofY + 19.5, cz - 34);
  batcher.addBox('siren_red', 1.8, 1.8, 1.8, cx - 7, roofY + 9.2, cz - 34);
  batcher.addBox('siren_blue', 1.8, 1.8, 1.8, cx + 7, roofY + 9.2, cz - 34);
  for (const antX of [cx - 32, cx + 32]) {
    batcher.addCylinder('brushed_silver', 0.35, 0.65, 15.0, antX, roofY + 7.5, cz + 34, 8);
    batcher.addBox('siren_red', 1.4, 1.4, 1.4, antX, roofY + 15.5, cz + 34);
  }

  // Escada / Elevador Externo de Acesso Tático na Face Norte da Cidadela (X = 1375, Z = 1482)
  batcher.addBox('dark_steel', 8.0, towerH, 6.0, cx, roofY * 0.5, cz - 58);
  for (let sy = 4; sy <= towerH; sy += 4) {
    batcher.addBox('alert_yellow', 6.4, 0.35, 1.4, cx, sy, cz - 61.2);
  }

  // Letreiros Luminosos Gigantes nas 4 Faces da Cidadela Panóptica ("A BALSA")
  _addPrisonBannerSign(world, cx, 93.0, cz - 43.2, 72.0, 6.8, 'CIDADELA PANÓPTICA — "A BALSA"', 'COMANDO CENTRAL DE SEGURANÇA MÁXIMA • BOPE', Math.PI);
  _addPrisonBannerSign(world, cx, 93.0, cz + 43.2, 72.0, 6.8, 'CONTROLE PANÓPTICO FEDERAL', 'VIGILÂNCIA 360° • DUPLO HELIPONTO TÁTICO', 0);

  world.addCollider(cx, cz, 108, 108, towerH, 0.28);
  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: 112,
    d: 112,
    height: towerH,
    color: '#090a0d',
    isLandmark: true,
    label: 'A BALSA (CIDADELA 126M)'
  });

  // ==========================================================================
  // 4 PASSARELAS AÉREAS BLINDADAS (SKYBRIDGES EM Y = 40m! DENTRO DE 35..45m)
  // Saindo em cruz (Oeste, Leste, Sul, Norte) da Cidadela Central direto para os Pavilhões!
  // ==========================================================================
  const skyY = 40;
  // 1. Skybridge Oeste (X = 1135..1325, Z = 1540 -> liga Cidadela ao Pavilhão 2 do CV)
  _buildArmoredSkybridge(world, batcher, 1230, skyY, 1540, 190, 11, true);
  // 2. Skybridge Leste (X = 1425..1615, Z = 1540 -> liga Cidadela ao Pavilhão 3 do PCC)
  _buildArmoredSkybridge(world, batcher, 1520, skyY, 1540, 190, 11, true);
  // 3. Skybridge Sul (X = 1375, Z = 1590..1785 -> liga Cidadela ao Pavilhão 1 Contenção Ômega)
  _buildArmoredSkybridge(world, batcher, 1375, skyY, 1687.5, 11, 195, false);
  // 4. Skybridge Norte (X = 1375, Z = 1255..1485 -> liga Cidadela aos Pavilhões 4 & 5 de Administração/Triagem)
  _buildArmoredSkybridge(world, batcher, 1375, skyY, 1370, 11, 230, false);
}

function _buildArmoredSkybridge(world, batcher, x, y, z, w, d, isAlongX) {
  batcher.addBox('dark_steel', w, 6.2, d, x, y, z);
  batcher.addBox('smoked_glass', isAlongX ? w - 4 : w + 0.4, 2.6, isAlongX ? d + 0.4 : d - 4, x, y + 0.5, z);
  batcher.addBox('alert_yellow', w + 0.5, 0.65, d + 0.5, x, y - 2.9, z);
  batcher.addBox('alert_yellow', w + 0.5, 0.65, d + 0.5, x, y + 3.0, z);
  // Guardas do BOPE patrulhando no teto das Passarelas Aéreas Blindadas
  _addBatchedLegoPerson(batcher, x, y + 3.4, z, isAlongX ? Math.PI / 2 : 0, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount++;
  world.addCollider(x, z, w, d, 6.5, y - 3.1);
}

/**
 * 4. OS 6 PAVILHÕES PENITENCIÁRIOS ALTOS (58m A 82m DE ALTURA! PROIBIDO PRÉDIO BAIXO!):
 * 1. Pavilhão 1 (Fundo / Sul-Interior X=1375, Z=1825, H=82m): Ala de Super-Segurança ("Contenção Ômega")
 *    com 8 Celas de Contenção Energética (barras de laser azul-neon/roxo) prendendo mercenários da A.R.E.S. e super-criminosos;
 * 2. Pavilhão 2 (Oeste X=1095, Z=1540, H=66m): Ala dos Presos do CV com 8 celas térreas de ferro preto;
 * 3. Pavilhão 3 (Leste X=1655, Z=1540, H=66m): Ala dos Presos do PCC com 8 celas térreas de ferro preto;
 * 4 & 5. Pavilhões 4 e 5 (Entrada Norte X=1235 e X=1515, Z=1225, H=58m): Administração & Arsenal do BOPE + Triagem
 *    com Portões Internos de Grade Dupla para Comboios (Sallie Port);
 * 6. Pavilhão 6 (Sudeste Interno X=1535, Z=1715, H=60m): Refeitório, Hospital Penitenciário & Lavanderia Industrial
 *    com chaminés altas de 78m e caixas d'água cilíndricas pretas/amarelas.
 */
function _buildSixTallPenitentiaryPavilions(world, batcher) {
  // ==========================================================================
  // PAVILHÃO 1 (SUL-INTERIOR: X = 1375, Z = 1825, H = 82m): ALA DE SUPER-SEGURANÇA ("CONTENÇÃO ÔMEGA")
  // ==========================================================================
  const omX = 1375;
  const omZ = 1825;
  const omH = 82; // 75..85m!
  batcher.addBox('bope_black', 280, omH - 8, 64, omX, 8.5 + (omH - 8) * 0.5, omZ);
  batcher.addBox('gunmetal_concrete', 284, 4.2, 68, omX, omH - 1.5, omZ);
  batcher.addBox('ares_purple', 285, 1.2, 69, omX, omH + 0.8, omZ);
  batcher.addBox('bope_black', 280, 8.5, 36, omX, 4.5, omZ + 14);
  world.addCollider(omX, omZ + 14, 280, 36, omH + 2, 0.28);

  // Contrafortes de Aço Pesado na fachada e Torretas de Vigilância no teto da Contenção Ômega
  for (let bx = omX - 120; bx <= omX + 120; bx += 40) {
    batcher.addBox('dark_steel', 6.5, omH, 8.0, bx, omH * 0.5, omZ - 31);
    batcher.addBox('laser_cyan', 1.6, omH - 14, 1.2, bx, omH * 0.5 + 4, omZ - 35.2);
    // Torreta de Vigilância Automatizada no teto
    batcher.addCylinder('dark_steel', 4.2, 5.0, 5.5, bx, omH + 3.5, omZ - 24, 8);
    batcher.addBox('laser_purple', 3.2, 1.4, 5.5, bx, omH + 5.2, omZ - 26.5);
  }

  // Janelas Blindadas Roxas/Azuis em 9 Andares da Contenção Ômega
  for (let fy = 15; fy <= omH - 8; fy += 7.5) {
    for (let wx = omX - 110; wx <= omX + 110; wx += 20) {
      batcher.addBox('smoked_glass', 10.5, 3.2, 0.8, wx, fy, omZ - 32.2);
    }
  }

  _addPrisonBannerSign(
    world,
    omX,
    omH - 3.5,
    omZ - 33.5,
    92.0,
    7.2,
    'PAVILHÃO 01 — ALA DE SUPER-SEGURANÇA ("CONTENÇÃO ÔMEGA")',
    'CELAS DE CONTENÇÃO ENERGÉTICA LASER • MERCENÁRIOS A.R.E.S. & SUPER-CRIMINOSOS',
    Math.PI,
    '#38bdf8',
    '#38bdf8'
  );

  // 8 CELAS DE CONTENÇÃO ENERGÉTICA NO TÉRREO DA CONTENÇÃO ÔMEGA (Barras de Laser Azul-Neon e Roxo!)
  const omegaCellX = [1270, 1300, 1330, 1360, 1390, 1420, 1450, 1480];
  omegaCellX.forEach((cellX, idx) => {
    _buildEnergyLaserContainmentCell(
      world,
      batcher,
      cellX,
      omZ - 14.0,
      26,
      24,
      idx % 2 === 0 ? 'laser_cyan' : 'laser_purple'
    );
  });

  world.mapBuildings.push({
    x: omX,
    z: omZ,
    w: 280,
    d: 64,
    height: omH,
    color: '#581c87',
    label: 'CONTENÇÃO ÔMEGA (82M)'
  });

  // ==========================================================================
  // PAVILHÃO 2 (OESTE: X = 1095, Z = 1540, H = 66m): ALA DOS PRESOS DO CV (COMANDO VERMELHO)
  // ==========================================================================
  _buildSideDetentionPavilionWithCells(
    world,
    batcher,
    1095,
    1540,
    66,
    1,
    'PAVILHÃO 02 — ALA DE DETENÇÃO CV (OESTE)',
    '8 CELAS TÉRREAS DE FERRO • PASSARELAS METÁLICAS & ESCADAS DE INCÊNDIO',
    'prisoner_cv'
  );

  // ==========================================================================
  // PAVILHÃO 3 (LESTE: X = 1655, Z = 1540, H = 66m): ALA DOS PRESOS DO PCC (PRIMEIRO COMANDO)
  // ==========================================================================
  _buildSideDetentionPavilionWithCells(
    world,
    batcher,
    1655,
    1540,
    66,
    -1,
    'PAVILHÃO 03 — ALA DE DETENÇÃO PCC (LESTE)',
    '8 CELAS TÉRREAS DE FERRO • ISOLAMENTO DISCIPLINAR DE ALTA SEGURANÇA',
    'prisoner_pcc'
  );

  // ==========================================================================
  // PAVILHÕES 4 & 5 (ENTRADA NORTE: X = 1235 e X = 1515, Z = 1225, H = 58m) + SALLIE PORT DUPLO
  // ==========================================================================
  _buildAdminAndTriagePavilionsWithSalliePort(world, batcher);

  // ==========================================================================
  // PAVILHÃO 6 (SUDESTE INTERNO: X = 1535, Z = 1715, H = 60m): REFEITÓRIO, HOSPITAL & LAVANDERIA
  // ==========================================================================
  _buildHospitalRefectoryAndLaundryPavilion(world, batcher);
}

/**
 * Constrói 1 Cela de Contenção Energética na Ala Ômega com Barras de Laser Azul-Neon / Roxo e Mercenários A.R.E.S.
 */
function _buildEnergyLaserContainmentCell(world, batcher, x, z, w, d, laserMatKey) {
  world.prisonIslandData.energyContainmentCellsCount++;
  world.prisonIslandData.visibleGroundCellsCount++;
  const cellH = 8.0;

  batcher.addBox('dark_steel', w - 1.2, 0.22, d - 1.2, x, 0.38, z);
  batcher.addBox(laserMatKey, 5.5, 0.24, 5.5, x, cellH - 0.2, z);
  batcher.addBox('gunmetal_concrete', 1.6, cellH, d, x - w * 0.5, 0.28 + cellH * 0.5, z);
  batcher.addBox('gunmetal_concrete', 1.6, cellH, d, x + w * 0.5, 0.28 + cellH * 0.5, z);

  // Cápsula/Cama de estase magnética no fundo da cela Ômega
  batcher.addBox('ares_purple', 6.5, 1.2, 4.2, x, 1.1, z + 5.5);

  // Emissores Superiores/Inferiores + 9 Barras Verticais de Laser Energético Brilhante!
  const barsZ = z - (d * 0.5 - 0.6);
  batcher.addBox('bope_black', w, 0.75, 0.9, x, 0.7, barsZ);
  batcher.addBox('bope_black', w, 0.75, 0.9, x, cellH - 0.2, barsZ);
  for (let bx = x - w * 0.5 + 2.2; bx <= x + w * 0.5 - 2.2; bx += 2.6) {
    batcher.addCylinder(laserMatKey, 0.26, 0.26, cellH - 0.8, bx, 0.28 + cellH * 0.5, barsZ, 8);
  }
  world.addCollider(x, barsZ, w, 1.2, cellH, 0.28);

  // 2 Super-Criminosos / Mercenários A.R.E.S. contidos atrás das barras de laser!
  _addBatchedLegoPerson(batcher, x - 3.0, 0.42, barsZ + 1.8, Math.PI, 'prisoner_ares', 'hands_bars');
  _addBatchedLegoPerson(batcher, x + 3.5, 0.42, z + 1.5, Math.PI, 'prisoner_ares', 'stand');
  world.prisonIslandData.prisonersInCellsCount += 2;
  world.prisonIslandData.aresPrisonersCount += 2;
}

/**
 * Constrói os Pavilhões 2 (Oeste - CV) e 3 (Leste - PCC) de 66m de altura com 7 andares,
 * passarelas metálicas externas, escadas de incêndio, chaminés e 8 celas térreas visíveis em cada um!
 */
function _buildSideDetentionPavilionWithCells(world, batcher, cx, cz, h, dir, title, subTitle, factionPreset) {
  const spineW = 54;
  const spineD = 320; // Z = 1380..1700
  const spineX = cx - dir * 10;

  batcher.addBox('gunmetal_concrete', spineW, h - 8.2, spineD, spineX, 8.5 + (h - 8.2) * 0.5, cz);
  batcher.addBox('bope_black', spineW + 2, 3.8, spineD + 2, spineX, h - 1.2, cz);
  batcher.addBox('alert_yellow', spineW + 2.6, 0.9, spineD + 2.6, spineX, h + 0.6, cz);

  // Pilares laterais térreos e parede de fundo das 8 celas
  batcher.addBox('gunmetal_concrete', spineW, 8.5, 44, spineX, 4.5, cz - 138);
  batcher.addBox('gunmetal_concrete', spineW, 8.5, 44, spineX, 4.5, cz + 138);
  batcher.addBox('bope_black', 22, 8.5, 232, spineX - dir * 16, 4.5, cz);
  world.addCollider(spineX - dir * 16, cz, 22, 320, h + 1, 0.28);
  world.addCollider(spineX, cz - 138, spineW, 44, h + 1, 0.28);
  world.addCollider(spineX, cz + 138, spineW, 44, h + 1, 0.28);

  // 2 Alas Avançadas em "U" nas extremidades Norte e Sul do Pavilhão
  for (const wingZ of [cz - 138, cz + 138]) {
    const wingX = cx + dir * 24;
    batcher.addBox('gunmetal_concrete', 42, h - 4, 46, wingX, 0.28 + (h - 4) * 0.5, wingZ);
    batcher.addBox('bope_black', 44, 3.2, 48, wingX, h - 3.2, wingZ);
    world.addCollider(wingX, wingZ, 42, 46, h - 2, 0.28);
  }

  // 7 Andares de Janelas Gradeadas Estreitas + Passarelas Metálicas Externas + Escadas de Incêndio + Chaminés
  const frontX = spineX + dir * (spineW * 0.5 + 0.2);
  for (let floorY = 14; floorY <= h - 6; floorY += 7.5) {
    // Passarela metálica externa a cada 2 andares
    if (floorY === 21.5 || floorY === 36.5 || floorY === 51.5) {
      batcher.addBox('dark_steel', 3.6, 0.45, spineD - 60, frontX + dir * 1.8, floorY - 1.8, cz);
      batcher.addBox('chainlink_mesh', 0.25, 1.4, spineD - 60, frontX + dir * 3.5, floorY - 1.0, cz);
    }
    for (let wz = cz - 135; wz <= cz + 135; wz += 15) {
      batcher.addBox('matte_black', 0.8, 3.4, 6.8, frontX, floorY, wz);
      batcher.addBox('brushed_silver', 1.0, 3.4, 0.28, frontX, floorY, wz - 1.8);
      batcher.addBox('brushed_silver', 1.0, 3.4, 0.28, frontX, floorY, wz);
      batcher.addBox('brushed_silver', 1.0, 3.4, 0.28, frontX, floorY, wz + 1.8);
    }
  }

  // Escadas de Incêndio Metálicas Externas e Chaminés de Ventilação no Teto
  for (const pipeZ of [cz - 82, cz, cz + 82]) {
    batcher.addBox('dark_steel', 3.8, h - 8, 6.2, frontX + dir * 2.2, (h - 8) * 0.5 + 4, pipeZ);
    batcher.addCylinder('brushed_silver', 1.8, 2.2, 12.0, spineX, h + 6.0, pipeZ, 10);
  }

  _addPrisonBannerSign(
    world,
    frontX + dir * 1.2,
    h - 2.6,
    cz,
    68.0,
    5.8,
    title,
    subTitle,
    dir > 0 ? Math.PI / 2 : -Math.PI / 2
  );

  // GALERIA DE 8 CELAS VISÍVEIS NO TÉRREO (com grades de ferro pretas e detentos lá dentro!)
  const cellZList = [cz - 98, cz - 70, cz - 42, cz - 14, cz + 14, cz + 42, cz + 70, cz + 98];
  cellZList.forEach((cellZ, idx) => {
    _buildVisibleGroundCell(
      world,
      batcher,
      spineX + dir * 11.0,
      cellZ,
      26,
      26,
      dir > 0 ? 'east' : 'west',
      idx % 2 === 0 ? factionPreset : 'prisoner_orange'
    );
  });

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: 84,
    d: spineD,
    height: h,
    color: dir > 0 ? '#991b1b' : '#1e3a8a',
    label: title.split(' — ')[0]
  });
}

function _buildVisibleGroundCell(world, batcher, x, z, w, d, facing, prisonerPreset) {
  world.prisonIslandData.visibleGroundCellsCount++;
  const cellH = 7.8;

  batcher.addBox('brushed_silver', w - 1.5, 0.18, d - 1.5, x, 0.38, z);
  batcher.addBox('searchlight_white', 4.5, 0.22, 4.5, x, cellH - 0.2, z);

  const dir = facing === 'east' ? 1 : -1;
  const barsX = x + dir * (w * 0.5 - 0.6);

  batcher.addBox('gunmetal_concrete', w, cellH, 1.4, x, 0.28 + cellH * 0.5, z - d * 0.5);
  batcher.addBox('gunmetal_concrete', w, cellH, 1.4, x, 0.28 + cellH * 0.5, z + d * 0.5);
  batcher.addBox('armor_slate', 4.2, 0.45, 7.5, x - dir * 5.5, 1.2, z - 6.0);
  batcher.addBox('prison_orange', 3.6, 0.28, 6.8, x - dir * 5.5, 1.55, z - 6.0);
  batcher.addBox('armor_slate', 4.2, 0.45, 7.5, x - dir * 5.5, 3.6, z - 6.0);
  batcher.addBox('prison_orange', 3.6, 0.28, 6.8, x - dir * 5.5, 3.95, z - 6.0);

  batcher.addBox('matte_black', 0.65, 0.55, d, barsX, 1.2, z);
  batcher.addBox('matte_black', 0.65, 0.55, d, barsX, 4.2, z);
  batcher.addBox('matte_black', 0.65, 0.65, d, barsX, cellH - 0.2, z);
  for (let bz = z - d * 0.5 + 1.8; bz <= z + d * 0.5 - 1.8; bz += 2.0) {
    batcher.addCylinder('matte_black', 0.22, 0.22, cellH, barsX, 0.28 + cellH * 0.5, bz, 8);
  }
  world.addCollider(barsX, z, 1.2, d, cellH, 0.28);

  const rotOut = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  _addBatchedLegoPerson(batcher, barsX - dir * 1.6, 0.42, z - 3.2, rotOut, prisonerPreset, 'hands_bars');
  _addBatchedLegoPerson(batcher, x - dir * 1.5, 0.42, z + 4.2, rotOut, 'prisoner_orange', 'stand');

  world.prisonIslandData.prisonersInCellsCount += 2;
  world.prisonIslandData.orangePrisonersCount += 1;
  if (prisonerPreset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
  else if (prisonerPreset === 'prisoner_pcc') world.prisonIslandData.pccPrisonersCount++;
  else world.prisonIslandData.orangePrisonersCount++;
}

/**
 * Constrói os Pavilhões 4 & 5 (H = 58m na Entrada Norte: X = 1235 e X = 1515, Z = 1225)
 * + Portões Internos de Grade Dupla para Comboios (Sallie Port em X = 1375, Z = 1190 e Z = 1255)
 */
function _buildAdminAndTriagePavilionsWithSalliePort(world, batcher) {
  const configs = [
    {
      x: 1235,
      z: 1225,
      h: 58,
      title: 'PAVILHÃO 04 — ADMINISTRAÇÃO & ARSENAL DO BOPE',
      sub: 'COMANDO TÁTICO • SALA DE CONTROLE & PAIOL BLINDADO',
      label: 'ARSENAL DO BOPE (58M)'
    },
    {
      x: 1515,
      z: 1225,
      h: 58,
      title: 'PAVILHÃO 05 — CENTRO DE TRIAGEM & INCLUSÃO',
      sub: 'IDENTIFICAÇÃO DE DETENTOS • ESCOLTA PENITENCIÁRIA',
      label: 'PRÉDIO DE TRIAGEM (58M)'
    }
  ];

  for (const cfg of configs) {
    batcher.addBox('bope_black', 148, cfg.h, 76, cfg.x, cfg.h * 0.5 + 0.28, cfg.z);
    batcher.addBox('gunmetal_concrete', 140, cfg.h + 1.5, 68, cfg.x, (cfg.h + 1.5) * 0.5 + 0.28, cfg.z);
    batcher.addBox('alert_yellow', 150, 1.2, 78, cfg.x, cfg.h + 1.2, cfg.z);

    for (let fy = 12; fy <= cfg.h - 6; fy += 8) {
      batcher.addBox('smoked_glass', 132, 3.2, 78.2, cfg.x, fy, cfg.z);
    }

    // Holofotes e Antenas no Topo
    batcher.addBox('searchlight_white', 4.5, 2.2, 1.5, cfg.x - 45, cfg.h + 2.4, cfg.z - 38);
    batcher.addBox('searchlight_white', 4.5, 2.2, 1.5, cfg.x + 45, cfg.h + 2.4, cfg.z - 38);

    _addPrisonBannerSign(world, cfg.x, cfg.h - 3.5, cfg.z - 39.2, 64.0, 5.8, cfg.title, cfg.sub, Math.PI);
    world.addCollider(cfg.x, cfg.z, 148, 76, cfg.h + 2, 0.28);
    world.mapBuildings.push({ x: cfg.x, z: cfg.z, w: 148, d: 76, height: cfg.h, color: '#111827', label: cfg.label });
  }

  // SALLIE PORT (2 Pórticos Internos de Grade Dupla para Comboios cruzando a Avenida Central em Z = 1190 e Z = 1258)
  for (const spZ of [1190, 1258]) {
    batcher.addBox('dark_steel', 132, 6.5, 6.0, 1375, 24.5, spZ);
    batcher.addBox('alert_yellow', 133, 0.85, 6.4, 1375, 21.2, spZ);
    for (const side of [-1, 1]) {
      const pilX = 1375 + side * 24;
      batcher.addBox('bope_black', 8.0, 22.0, 6.5, pilX, 11.2, spZ);
      world.addCollider(pilX, spZ, 8.0, 6.5, 24, 0.28);
      // Grades laterais retráteis do Sallie Port (deixando 34m livres no centro para os ônibus celulares!)
      for (let gx = 16; gx <= 21; gx += 1.6) {
        batcher.addCylinder('brushed_silver', 0.26, 0.26, 20.0, 1375 + side * gx, 10.5, spZ, 8);
      }
    }
  }
}

/**
 * Constrói o Pavilhão 6 (Sudeste Interno: X = 1535, Z = 1715, H = 60m):
 * Refeitório Central, Hospital Penitenciário & Lavanderia Industrial com Chaminés Altas (78m) e Caixas d'Água Pretas/Amarelas
 */
function _buildHospitalRefectoryAndLaundryPavilion(world, batcher) {
  const hx = 1535;
  const hz = 1715;
  const hh = 60; // 55..85m!

  batcher.addBox('gunmetal_concrete', 136, hh, 82, hx, hh * 0.5 + 0.28, hz);
  batcher.addBox('bope_black', 140, 4.0, 86, hx, hh - 1.5, hz);
  batcher.addBox('alert_yellow', 141, 1.0, 87, hx, hh + 0.8, hz);

  // Cruz Médica Azul/Branca do Hospital Penitenciário na fachada Oeste
  batcher.addBox('tactical_white', 1.4, 18.0, 18.0, hx - 68.5, 38.0, hz - 18);
  batcher.addBox('police_blue', 1.8, 14.0, 4.6, hx - 68.7, 38.0, hz - 18);
  batcher.addBox('police_blue', 1.8, 4.6, 14.0, hx - 68.7, 38.0, hz - 18);

  for (let fy = 12; fy <= hh - 8; fy += 8) {
    batcher.addBox('smoked_glass', 138, 3.0, 72, hx, fy, hz);
  }

  // 2 Chaminés Industriais Altas da Lavanderia/Caldeiras (Y = 78m!) no topo do Pavilhão 6
  for (const chX of [hx - 36, hx + 36]) {
    batcher.addCylinder('dark_steel', 3.4, 4.4, 22.0, chX, hh + 10.0, hz + 18, 12);
    batcher.addCylinder('alert_yellow', 3.6, 3.6, 2.2, chX, hh + 19.0, hz + 18, 12);
  }

  // Doca de Descarga de Suprimentos na base Norte do Pavilhão 6 (Z = 1670)
  batcher.addBox('armor_slate', 84, 3.2, 12, hx, 1.8, hz - 46);
  _addPrisonBannerSign(
    world,
    hx,
    hh - 3.2,
    hz - 42.2,
    68.0,
    5.8,
    'PAVILHÃO 06 — HOSPITAL, REFEITÓRIO & LAVANDERIA',
    'UNIDADE MÉDICA PENITENCIÁRIA • CALDEIRAS & SUPRIMENTOS',
    Math.PI
  );

  world.addCollider(hx, hz, 136, 82, hh + 2, 0.28);
  world.mapBuildings.push({
    x: hx,
    z: hz,
    w: 136,
    d: 82,
    height: hh,
    color: '#334155',
    label: 'HOSPITAL & REFEITÓRIO (60M)'
  });
}

/**
 * 5. PREENCHIMENTO 100% DO PÁTIO INTERNO EM 4 SETORES CERCADOS (ZERO CHÃO CINZA VAZIO!):
 * - Avenida Central Asfaltada + Alambrados Duplos de Tela Metálica + Passarelas Elevadas de Ronda (com guardas em cima!);
 * - Setor 1 (Oeste/Sudoeste: X = 1170..1310, Z = 1310..1740): Grande Pátio de Banho de Sol com 2 Quadras Esportivas
 *   Completas (1 Futsal + 1 Basquete), Arquibancadas de Concreto, Academia de Musculação ao Ar Livre (12 bancos),
 *   20 Mesas de Concreto e dezenas de detentos de uniforme laranja vigiados por guardas nas passarelas elevadas;
 * - Setor 2 (Nordeste: X = 1435..1595, Z = 1280..1380): Garagem Tática & Pátio de Comboios Policiais com
 *   4 Ônibus Celulares Blindados, Caveirões do BOPE, viaturas e caixas de arsenal;
 * - Setor 3 (Centro-Leste: X = 1435..1595, Z = 1395..1535): Subestação de Energia & Geradores da Prisão com
 *   6 Transformadores Gigantes, 6 Geradores a Diesel, 8 Bobinas e 4 Torres de Energia;
 * - Setor 4 (Sudeste: X = 1435..1595, Z = 1565..1665): Pátio Logístico de Caixas d'Água Cilíndricas Pretas/Amarelas e Suprimentos.
 */
function _buildFourInternalCourtyardSectors(world, batcher) {
  // Vias Asfaltadas Internas conectando o Portão Norte (Z=1125) à Cidadela Central (Z=1540) e aos Setores
  batcher.addBox('matte_black', 42, 0.14, 360, 1375, 0.34, 1305);
  batcher.addBox('alert_yellow', 0.45, 0.06, 350, 1374.4, 0.41, 1305);
  batcher.addBox('alert_yellow', 0.45, 0.06, 350, 1375.6, 0.41, 1305);
  world.mapRoads.push({ x: 1375, z: 1305, w: 42, d: 360, isMain: true });

  // ==========================================================================
  // PASSARELAS ELEVADAS DE RONDA (Y = 9.5m) & ALAMBRADOS DUPLOS DE TELA METÁLICA DIVIDINDO OS SETORES
  // ==========================================================================
  const catwalks = [
    [1315, 1525, 6.0, 420, false], // Passarela Elevada Leste do Pátio de Banho de Sol
    [1240, 1310, 150, 6.0, true],  // Passarela Elevada Norte do Pátio de Banho de Sol
    [1240, 1525, 150, 6.0, true],  // Passarela Elevada Central entre as 2 Quadras e a Academia
    [1240, 1740, 150, 6.0, true],  // Passarela Elevada Sul do Pátio de Banho de Sol
    [1435, 1465, 6.0, 360, false], // Passarela Elevada Oeste da Garagem / Subestação / Pátio Logístico
    [1515, 1388, 160, 6.0, true]   // Passarela Elevada entre Garagem Tática e Subestação de Energia
  ];
  for (const [cwX, cwZ, cwW, cwD, isHoriz] of catwalks) {
    world.prisonIslandData.elevatedGuardCatwalksCount++;
    batcher.addBox('dark_steel', cwW, 0.8, cwD, cwX, 9.5, cwZ);
    batcher.addBox('alert_yellow', cwW + 0.4, 0.25, cwD + 0.4, cwX, 9.9, cwZ);
    // Alambrado Duplo de Tela Metálica sob a passarela (Y = 0.3..9.2m)
    batcher.addBox('chainlink_mesh', isHoriz ? cwW : 0.35, 8.8, isHoriz ? 0.35 : cwD, cwX - (isHoriz ? 0 : 1.8), 4.7, cwZ - (isHoriz ? 1.8 : 0));
    batcher.addBox('chainlink_mesh', isHoriz ? cwW : 0.35, 8.8, isHoriz ? 0.35 : cwD, cwX + (isHoriz ? 0 : 1.8), 4.7, cwZ + (isHoriz ? 1.8 : 0));
    // Guardas do BOPE armados vigiando de cima das Passarelas Elevadas de Ronda!
    _addBatchedLegoPerson(batcher, cwX, 10.0, cwZ, isHoriz ? 0 : -Math.PI / 2, 'bope_guard', 'stand');
    _addBatchedLegoPerson(
      batcher,
      cwX + (isHoriz ? 28 : 0),
      10.0,
      cwZ + (isHoriz ? 0 : 35),
      isHoriz ? Math.PI : -Math.PI / 2,
      'warden_police',
      'stand'
    );
    world.prisonIslandData.guardsCount += 2;
  }

  // ==========================================================================
  // SETOR 1 (X = 1170..1310, Z = 1315..1735): GRANDE PÁTIO DE BANHO DE SOL DOS DETENTOS
  // - Quadra 1 (Z = 1375): Quadra Oficial de Futsal (Verde/Branca com traves e arquibancada de concreto)
  // - Quadra 2 (Z = 1470): Quadra Oficial de Basquete (Azul/Laranja com tabelas e arquibancada de concreto)
  // - Academia de Musculação ao Ar Livre (Z = 1585): 12 Bancos de Supino, Gaiola de Barras e Pesos LEGO
  // - Pátio de Mesas de Concreto (Z = 1685): 20 Mesas e Bancos Duplos de Concreto com detentos
  // ==========================================================================
  // 1A. QUADRA DE FUTSAL (X = 1235, Z = 1375 — 62m x 82m) + Arquibancada de Concreto
  const futX = 1235;
  const futZ = 1375;
  batcher.addBox('futsal_green', 62, 0.14, 82, futX, 0.34, futZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ - 39);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ + 39);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, futX - 29, 0.42, futZ);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, futX + 29, 0.42, futZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ);
  batcher.addCylinder('tactical_white', 7.0, 7.0, 0.06, futX, 0.42, futZ, 16);
  for (const dir of [-1, 1]) {
    const goalZ = futZ + dir * 38.5;
    batcher.addBox('tactical_white', 11.0, 0.38, 0.38, futX, 3.6, goalZ);
    batcher.addBox('tactical_white', 0.38, 3.4, 0.38, futX - 5.3, 1.98, goalZ);
    batcher.addBox('tactical_white', 0.38, 3.4, 0.38, futX + 5.3, 1.98, goalZ);
  }
  // Arquibancada de Concreto de 4 Degraus ao lado da Quadra de Futsal (X = 1280, Z = 1375)
  for (let step = 0; step < 4; step++) {
    batcher.addBox('gunmetal_concrete', 3.2, (step + 1) * 1.1, 72, 1274 + step * 3.2, 0.28 + (step + 1) * 0.55, futZ);
  }

  // 1B. QUADRA DE BASQUETE (X = 1235, Z = 1472 — 62m x 82m) + Tabelas + Arquibancada de Concreto
  const bskX = 1235;
  const bskZ = 1472;
  batcher.addBox('court_blue', 62, 0.14, 82, bskX, 0.34, bskZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ - 39);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ + 39);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, bskX - 29, 0.42, bskZ);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, bskX + 29, 0.42, bskZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ);
  for (const dir of [-1, 1]) {
    const hoopZ = bskZ + dir * 37.5;
    batcher.addBox('prison_orange', 14, 0.06, 15, bskX, 0.41, bskZ + dir * 31);
    batcher.addCylinder('dark_steel', 0.35, 0.42, 6.8, bskX, 3.68, hoopZ + dir * 2.0, 8);
    batcher.addBox('tactical_white', 4.8, 3.2, 0.35, bskX, 6.4, hoopZ + dir * 0.5);
    batcher.addBox('prison_orange', 1.6, 0.24, 1.6, bskX, 5.4, hoopZ - dir * 0.3);
  }
  for (let step = 0; step < 4; step++) {
    batcher.addBox('gunmetal_concrete', 3.2, (step + 1) * 1.1, 72, 1274 + step * 3.2, 0.28 + (step + 1) * 0.55, bskZ);
  }

  // 20 Detentos LEGO jogando Futsal e Basquete ou assistindo nas arquibancadas
  const sportsInmates = [
    [futX - 10, futZ - 18, 0, 'prisoner_orange'], [futX + 12, futZ - 12, 0.6, 'prisoner_cv'],
    [futX - 6, futZ + 8, -0.5, 'prisoner_pcc'], [futX + 14, futZ + 20, 2.4, 'prisoner_orange'],
    [futX, futZ - 34, 0, 'prisoner_orange'], [futX, futZ + 34, Math.PI, 'prisoner_cv'],
    [bskX - 12, bskZ - 16, 0.4, 'prisoner_orange'], [bskX + 10, bskZ - 8, -0.8, 'prisoner_pcc'],
    [bskX - 8, bskZ + 14, 1.8, 'prisoner_cv'], [bskX + 12, bskZ + 22, -2.2, 'prisoner_orange'],
    [1277, futZ - 15, -Math.PI / 2, 'prisoner_orange'], [1277, futZ + 15, -Math.PI / 2, 'prisoner_cv'],
    [1277, bskZ - 15, -Math.PI / 2, 'prisoner_pcc'], [1277, bskZ + 15, -Math.PI / 2, 'prisoner_orange']
  ];
  for (const [px, pz, rot, preset] of sportsInmates) {
    _addBatchedLegoPerson(batcher, px, 0.42, pz, rot, preset, 'stand');
    if (preset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
    else if (preset === 'prisoner_pcc') world.prisonIslandData.pccPrisonersCount++;
    else world.prisonIslandData.orangePrisonersCount++;
  }

  // 1C. ACADEMIA DE MUSCULAÇÃO AO AR LIVRE (X = 1235, Z = 1585 — 12 Bancos de Supino & Aparelhos!)
  const gymX = 1235;
  const gymZ = 1585;
  batcher.addBox('matte_black', 92, 0.14, 78, gymX, 0.34, gymZ);
  batcher.addBox('alert_yellow', 92.5, 0.08, 1.2, gymX, 0.38, gymZ - 38.5);
  batcher.addBox('alert_yellow', 92.5, 0.08, 1.2, gymX, 0.38, gymZ + 38.5);
  batcher.addBox('dark_steel', 24.0, 4.4, 5.0, gymX, 2.5, gymZ);

  for (let row = -1; row <= 1; row += 2) {
    for (let col = -2.5; col <= 2.5; col += 1) {
      const bx = gymX + col * 13.5;
      const bz = gymZ + row * 18.0;
      world.prisonIslandData.weightBenchesCount++;
      batcher.addBox('dark_steel', 1.5, 0.75, 4.2, bx, 0.75, bz);
      batcher.addBox('prison_orange', 1.6, 0.25, 4.0, bx, 1.22, bz);
      batcher.addBox('brushed_silver', 2.4, 2.2, 0.35, bx, 1.45, bz - 1.5);
      batcher.addBox('brushed_silver', 4.4, 0.22, 0.22, bx, 2.35, bz - 1.5);
      for (const side of [-1, 1]) {
        batcher.addCylinder('bope_black', 0.75, 0.75, 0.32, bx + side * 1.65, 2.35, bz - 1.5, 8, 0, Math.PI / 2);
      }
      const preset = col < 0 ? 'prisoner_cv' : 'prisoner_orange';
      _addBatchedLegoPerson(batcher, bx, 0.42, bz + 2.8, 0, preset, 'bench_press');
      if (preset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
      else world.prisonIslandData.orangePrisonersCount++;
    }
  }

  // 1D. PÁTIO DE MESAS E BANCOS DE CONCRETO (X = 1235, Z = 1685 — 20 Mesas de Concreto 5x4!)
  const cafeX = 1235;
  const cafeZ = 1685;
  batcher.addBox('armor_slate', 92, 0.16, 82, cafeX, 0.35, cafeZ);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const tx = cafeX - 32 + c * 16;
      const tz = cafeZ - 26 + r * 17;
      world.prisonIslandData.cafeteriaTablesCount++;
      batcher.addBox('brushed_silver', 4.8, 1.15, 2.2, tx, 0.92, tz);
      batcher.addBox('gunmetal_concrete', 4.8, 0.68, 0.9, tx, 0.68, tz - 1.9);
      batcher.addBox('gunmetal_concrete', 4.8, 0.68, 0.9, tx, 0.68, tz + 1.9);
      if ((r + c) % 2 === 0) {
        _addBatchedLegoPerson(batcher, tx - 1.2, 0.42, tz - 2.6, 0, 'prisoner_orange', 'stand');
        _addBatchedLegoPerson(batcher, tx + 1.2, 0.42, tz + 2.6, Math.PI, 'prisoner_pcc', 'stand');
        world.prisonIslandData.orangePrisonersCount++;
        world.prisonIslandData.pccPrisonersCount++;
      }
    }
  }

  // ==========================================================================
  // SETOR 2 (X = 1515, Z = 1330): GARAGEM TÁTICA & PÁTIO DE COMBOIOS POLICIAIS
  // - 4 Ônibus / Caminhões Celulares Blindados + Caveirões do BOPE + Viaturas + Caixas de Arsenal
  // ==========================================================================
  const garX = 1515;
  const garZ = 1330;
  batcher.addBox('matte_black', 148, 0.14, 92, garX, 0.34, garZ);
  // Vagas Demarcadas com Faixas Amarelas no Piso para os Caveirões e Ônibus Celulares
  for (let vx = 1445; vx <= 1585; vx += 18) {
    batcher.addBox('alert_yellow', 0.45, 0.06, 22.0, vx, 0.41, 1315);
    batcher.addBox('alert_yellow', 0.45, 0.06, 22.0, vx, 0.41, 1355);
  }
  const busCoords = [
    [1454, 1355, Math.PI],
    [1478, 1355, Math.PI],
    [1502, 1355, Math.PI],
    [1526, 1355, Math.PI]
  ];
  for (const [bx, bz, rotY] of busCoords) {
    _addArmoredPrisonTransportBus(world, batcher, bx, bz, rotY);
  }
  // Galpão de Manutenção & Caixas de Arsenal Policial no Leste do Setor 2 (X = 1568, Z = 1330)
  batcher.addBox('bope_black', 34, 22, 76, 1568, 11.28, 1330);
  batcher.addBox('alert_yellow', 35, 0.9, 77, 1568, 22.2, 1330);
  world.addCollider(1568, 1330, 34, 76, 23, 0.28);

  // ==========================================================================
  // SETOR 3 (X = 1515, Z = 1465): SUBESTAÇÃO DE ENERGIA & GERADORES DA PRISÃO
  // - Cercado por Muretas Zebradas Amarelas e Pretas, 6 Transformadores Gigantes,
  //   6 Geradores a Diesel, 8 Bobinas de Alta Tensão e 4 Torres de Transmissão (H = 42m)!
  // ==========================================================================
  const subX = 1515;
  const subZ = 1465;
  batcher.addBox('gunmetal_concrete', 146, 0.22, 116, subX, 0.36, subZ);
  // Mureta Perimetral Zebrada Amarela/Preta da Subestação
  batcher.addBox('alert_yellow', 146, 2.2, 1.6, subX, 1.38, subZ - 57);
  batcher.addBox('alert_yellow', 146, 2.2, 1.6, subX, 1.38, subZ + 57);

  // 6 Transformadores Elétricos Gigantes com Aletas de Resfriamento e Buchas Isoladoras
  for (let tx = 1456; tx <= 1556; tx += 20) {
    world.prisonIslandData.substationTransformersCount++;
    batcher.addBox('armor_slate', 10.5, 11.0, 12.0, tx, 5.8, subZ - 26);
    batcher.addBox('dark_steel', 11.5, 8.5, 13.0, tx, 5.5, subZ - 26);
    batcher.addBox('alert_yellow', 11.6, 0.65, 13.2, tx, 11.2, subZ - 26);
    for (const bxOff of [-3, 0, 3]) {
      batcher.addCylinder('brushed_silver', 0.45, 0.65, 4.5, tx + bxOff, 13.5, subZ - 26, 8);
      batcher.addCylinder('laser_cyan', 0.55, 0.55, 0.8, tx + bxOff, 15.8, subZ - 26, 8);
      world.prisonIslandData.powerCoilsCount++;
    }
    world.addCollider(tx, subZ - 26, 11.5, 13.0, 14, 0.28);
  }

  // 6 Geradores Industriais a Diesel Blindados (Preto/Amarelo com escapamentos duplos)
  for (let gx = 1456; gx <= 1556; gx += 20) {
    world.prisonIslandData.dieselGeneratorsCount++;
    batcher.addBox('bope_black', 11.0, 7.2, 16.0, gx, 3.9, subZ + 18);
    batcher.addBox('alert_yellow', 11.4, 1.2, 16.4, gx, 3.8, subZ + 18);
    batcher.addCylinder('brushed_silver', 0.55, 0.55, 5.0, gx - 2.5, 9.5, subZ + 14, 8);
    batcher.addCylinder('brushed_silver', 0.55, 0.55, 5.0, gx + 2.5, 9.5, subZ + 14, 8);
    world.addCollider(gx, subZ + 18, 11.0, 16.0, 8.5, 0.28);
  }

  // 4 Torres de Energia / Transmissão de Alta Tensão (H = 42m!) nos cantos da Subestação
  const powerTowerCoords = [
    [1452, subZ - 46],
    [1576, subZ - 46],
    [1452, subZ + 46],
    [1576, subZ + 46]
  ];
  for (const [ptX, ptZ] of powerTowerCoords) {
    world.prisonIslandData.powerTowersCount++;
    batcher.addBox('dark_steel', 5.2, 42.0, 5.2, ptX, 21.28, ptZ);
    batcher.addBox('alert_yellow', 16.0, 1.4, 2.2, ptX, 32.0, ptZ);
    batcher.addBox('alert_yellow', 12.0, 1.4, 2.2, ptX, 39.5, ptZ);
    batcher.addBox('laser_cyan', 1.2, 1.8, 1.2, ptX - 7.2, 31.0, ptZ);
    batcher.addBox('laser_cyan', 1.2, 1.8, 1.2, ptX + 7.2, 31.0, ptZ);
    world.addCollider(ptX, ptZ, 5.5, 5.5, 42, 0.28);
  }

  // ==========================================================================
  // SETOR 4 (X = 1515, Z = 1612): PÁTIO DE CAIXAS D'ÁGUA CILÍNDRICAS PRETAS/AMARELAS & CALDEIRAS
  // ==========================================================================
  for (const wtX of [1462, 1498, 1534, 1570]) {
    world.prisonIslandData.waterTowersCount++;
    batcher.addCylinder('dark_steel', 6.5, 7.2, 14.0, wtX, 7.28, 1608, 12);
    batcher.addCylinder('bope_black', 8.2, 8.2, 22.0, wtX, 24.5, 1608, 16);
    batcher.addCylinder('alert_yellow', 8.4, 8.4, 2.6, wtX, 24.5, 1608, 16);
    batcher.addCylinder('alert_yellow', 8.4, 8.4, 1.8, wtX, 34.8, 1608, 16);
    world.addCollider(wtX, 1608, 16.5, 16.5, 36, 0.28);
  }
}

/**
 * Constrói 1 Ônibus / Caminhão Celular Blindado ("TRANSPORTE PENITENCIÁRIO" — 5.0m x 16.2m x 4.8m)
 */
function _addArmoredPrisonTransportBus(world, batcher, x, z, rotY = 0) {
  world.prisonIslandData.armoredPrisonBusesCount++;

  batcher.addBox('matte_black', 4.6, 1.2, 16.2, x, 0.9, z, 0, rotY, 0);
  batcher.addBox('gunmetal_concrete', 4.8, 3.4, 15.8, x, 3.0, z, 0, rotY, 0);
  batcher.addBox('bope_black', 4.95, 0.9, 16.0, x, 2.3, z, 0, rotY, 0);
  batcher.addBox('alert_yellow', 5.0, 0.35, 16.1, x, 1.8, z, 0, rotY, 0);

  batcher.addBox('smoked_glass', 4.2, 1.2, 1.2, x, 3.3, z + 7.5, 0, rotY, 0);
  batcher.addBox('brushed_silver', 4.9, 0.95, 11.5, x, 3.55, z - 0.8, 0, rotY, 0);
  batcher.addBox('siren_red', 1.4, 0.45, 0.8, x - 1.1, 4.9, z + 5.5, 0, rotY, 0);
  batcher.addBox('siren_blue', 1.4, 0.45, 0.8, x + 1.1, 4.9, z + 5.5, 0, rotY, 0);

  world.addCollider(x, z, 5.0, 16.4, 5.0, 0.28);
}
