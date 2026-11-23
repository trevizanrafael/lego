import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { makeTranslatedBox, mergeColoredGeometries } from '../../BuildingGenerator.js';
import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import {
  UMBRELLA_KEYS,
  getSouthBeachBayOffsetZ,
  getSouthBeachStandardVcMat,
  getSouthBeachBasicVcMat,
  addNeonHotelSign
} from './BeachBatcherAndConstants.js';

const SHARED_CRATE_GEO = markAsSharedAsset(new THREE.BoxGeometry(1.2, 1.2, 1.2));
const SHARED_CRATE_TAN_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: LEGO_COLORS.tan, roughness: 0.54, metalness: 0.05 })
);
const SHARED_CRATE_ORANGE_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: LEGO_COLORS.orange, roughness: 0.54, metalness: 0.05 })
);

const _CABIN_GEO_CACHE = new Map();

function _getMergedCabinGeometry(cabinColorHex) {
  if (_CABIN_GEO_CACHE.has(cabinColorHex)) return _CABIN_GEO_CACHE.get(cabinColorHex);
  const bodyCol = new THREE.Color(cabinColorHex);
  const glassCol = new THREE.Color(0x0c4a6e);
  const trimCol = new THREE.Color(0xf8fafc);
  const geo = mergeColoredGeometries([
    { geo: makeTranslatedBox(5.0, 2.0, 4.0, 0, -1.0, 0), color: bodyCol },
    { geo: makeTranslatedBox(4.8, 1.3, 3.8, 0, 0.45, 0), color: glassCol },
    { geo: makeTranslatedBox(5.2, 0.6, 4.2, 0, 1.35, 0), color: bodyCol },
    { geo: makeTranslatedBox(0.32, 0.45, 0.32, 0, 1.85, 0), color: trimCol }
  ]);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  markAsSharedAsset(geo);
  _CABIN_GEO_CACHE.set(cabinColorHex, geo);
  return geo;
}

/**
 * 3B. QUIOSQUES DE PRAIA ACOMPANHANDO A CURVA DO CALÇADÃO (tamanho 1x, zero sobreposição viária!)
 */
export function buildOceanfrontKiosks(world, batcher) {
  const baseKioskZ = ws(761);
  const kioskXList = [-460, -250, 135, 420].map(ws);
  kioskXList.forEach((kx, idx) => {
    buildBeachKiosk(world, batcher, kx, baseKioskZ + getSouthBeachBayOffsetZ(kx), idx, 'QUIOSQUE ORLA');
  });
  const westKioskXList = [-1580, -1320, -1060, -760].map(ws);
  westKioskXList.forEach((kx, idx) => {
    buildBeachKiosk(world, batcher, kx, baseKioskZ + getSouthBeachBayOffsetZ(kx), idx + 2, 'QUIOSQUE PONTA DA PRAIA');
  });
  if (IS_SCALED_WORLD) {
    const coastalExtraX = [-605, 315].map(ws);
    coastalExtraX.forEach((kx, idx) => {
      buildBeachKiosk(world, batcher, kx, baseKioskZ + getSouthBeachBayOffsetZ(kx), idx + 4, 'QUIOSQUE COSTEIRO');
    });
  }
}

export function buildBeachKiosk(world, batcher, kx, kz, idx, label = 'QUIOSQUE ORLA') {
  const yBase = 0.32;
  const roofColor = UMBRELLA_KEYS[idx % UMBRELLA_KEYS.length];

  batcher.addBox('wood_deck', 14.0, 0.24, 14.0, kx, yBase + 0.12, kz, false);
  batcher.addBox('coastal_white', 8.6, 1.25, 8.6, kx, yBase + 0.75, kz, false);
  batcher.addBox('wood_pier', 9.4, 0.22, 9.4, kx, yBase + 1.42, kz, false);

  batcher.addBox('wood_pier', 3.6, 3.4, 3.6, kx, yBase + 1.8, kz - 1.0, false);
  batcher.addBox('coastal_turquoise', 1.8, 1.3, 1.4, kx + 2.2, yBase + 1.5, kz - 1.2, true);
  batcher.addBox('glass_cyan', 1.5, 1.0, 1.4, kx + 2.2, yBase + 2.65, kz - 1.2, true);

  for (const [dx, dz] of [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]]) {
    batcher.addBox('wood_pier', 0.45, 3.8, 0.45, kx + dx, yBase + 2.0, kz + dz, true);
  }
  batcher.addBox(roofColor, 12.2, 0.65, 12.2, kx, yBase + 4.1, kz, false);
  batcher.addBox('trim_white', 9.2, 0.65, 9.2, kx, yBase + 4.75, kz, false);
  batcher.addBox(roofColor, 5.6, 0.75, 5.6, kx, yBase + 5.45, kz, false);

  for (const [mx, mz] of [[-8.5, -3.5], [8.5, -3.5], [-8.5, 4.5], [8.5, 4.5]]) {
    const tx = kx + mx;
    const tz = kz + mz;
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, tx, yBase + 0.4, tz, true);
    batcher.addBox('trim_white', 0.18, 2.5, 0.18, tx, yBase + 1.3, tz, true);
    batcher.addBox(roofColor, 3.2, 0.42, 3.2, tx, yBase + 2.6, tz, true);
    batcher.addBox('trim_white', 0.6, 0.55, 0.6, tx - 1.3, yBase + 0.28, tz, true);
    batcher.addBox('trim_white', 0.6, 0.55, 0.6, tx + 1.3, yBase + 0.28, tz, true);
  }

  if (world.destructibles) {
    for (let c = 0; c < 2; c++) {
      const crateX = kx - 5.2 + c * 1.6;
      const crateZ = kz - 5.2;
      const crateMesh = new THREE.Mesh(SHARED_CRATE_GEO, c === 0 ? SHARED_CRATE_TAN_MAT : SHARED_CRATE_ORANGE_MAT);
      crateMesh.position.set(crateX, yBase + 0.6, crateZ);
      crateMesh.castShadow = true;
      crateMesh.receiveShadow = true;
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
 * 5. MEGA PÍER PARQUE DE MADEIRA (540m MAR ADENTRO EM ESCALA 1x!), RESTAURANTE 2 ANDARES, FLIPERAMA,
 * CARROSSEL GIRATÓRIO, TORRE BIG DROP, RODA-GIGANTE COLOSSAL (73m, 16 Cabines), FAROL & MARINA LESTE!
 */
export function buildMonumentalPierFerrisWheelAndMarina(world, batcher) {
  const pierX = 0;
  const pierOriginZ = IS_SCALED_WORLD ? ws(1036) : 1030;
  const pzOff = pierOriginZ - 1030;
  const pz = (designZ) => designZ + pzOff;

  const mainPierZ = pz(1230);
  const mainPierW = 96;
  const mainPierD = 380;
  const endPlazaZ = pz(1495);
  const endPlazaW = 136;
  const endPlazaD = 150;
  const deckTopY = 1.6;
  const plazaSplitZ = pz(1420);

  // Rampa de Entrada + Tabuleiro Principal + Praça Oceânica consolidados no SouthBeachBatcher!
  batcher.addBox('pier_deck_brown', mainPierW - 10, 1.2, 24, pierX, 0.6, pierOriginZ, false);
  world.addCollider(pierX, pierOriginZ, mainPierW - 10, 24, 1.2, 0);

  batcher.addBox('pier_deck_brown', mainPierW, 1.6, mainPierD, pierX, deckTopY * 0.5, mainPierZ, false);
  world.addCollider(pierX, mainPierZ, mainPierW, mainPierD, deckTopY, 0);
  world.mapBlocks.push({ x: pierX, z: mainPierZ, w: mainPierW, d: mainPierD, color: '#92400e' });

  batcher.addBox('pier_plaza_brown', endPlazaW, 1.6, endPlazaD, pierX, deckTopY * 0.5, endPlazaZ, false);
  world.addCollider(pierX, endPlazaZ, endPlazaW, endPlazaD, deckTopY, 0);
  world.mapBlocks.push({ x: pierX, z: endPlazaZ, w: endPlazaW, d: endPlazaD, color: '#78350f' });

  if (IS_SCALED_WORLD && Array.isArray(world.elevatedDecks)) {
    world.elevatedDecks.push(
      {
        minX: -(mainPierW * 0.5),
        maxX: mainPierW * 0.5,
        minZ: mainPierZ - mainPierD * 0.5,
        maxZ: mainPierZ + mainPierD * 0.5,
        thresholdBelow: 1.8,
        getDeckY: () => deckTopY
      },
      {
        minX: -(endPlazaW * 0.5),
        maxX: endPlazaW * 0.5,
        minZ: endPlazaZ - endPlazaD * 0.5,
        maxZ: endPlazaZ + endPlazaD * 0.5,
        thresholdBelow: 1.8,
        getDeckY: () => deckTopY
      }
    );
  }

  // Estacas / Pilares de Madeira com Travessas fincados no Oceano sob o Mega Píer
  for (let pilingZ = pz(1048); pilingZ <= pz(1564); pilingZ += 22) {
    const halfW = pilingZ >= plazaSplitZ ? endPlazaW * 0.5 - 4 : mainPierW * 0.5 - 4;
    for (const px of [-halfW, -halfW * 0.5, 0, halfW * 0.5, halfW]) {
      batcher.addBox('wood_pilings', 1.6, 3.4, 1.6, px, -0.2, pilingZ, true);
    }
    batcher.addBox('wood_pilings', halfW * 2, 0.45, 0.45, 0, -0.1, pilingZ, true);
  }

  // Cercas Laterais Brancas de Segurança + Postes Duplos (L0 micro-detail para limpar a >= 280m!)
  batcher.addBox('trim_white', 0.5, 1.2, mainPierD, -mainPierW * 0.5 + 0.6, deckTopY + 0.6, mainPierZ, true);
  batcher.addBox('trim_white', 0.5, 1.2, mainPierD, mainPierW * 0.5 - 0.6, deckTopY + 0.6, mainPierZ, true);
  batcher.addBox('trim_white', 0.5, 1.2, endPlazaD, -endPlazaW * 0.5 + 0.6, deckTopY + 0.6, endPlazaZ, true);
  batcher.addBox('trim_white', 0.5, 1.2, endPlazaD, endPlazaW * 0.5 - 0.6, deckTopY + 0.6, endPlazaZ, true);
  batcher.addBox('trim_white', endPlazaW, 1.2, 0.5, pierX, deckTopY + 0.6, pz(1569.4), true);

  for (let lz = pz(1055); lz <= pz(1555); lz += 25) {
    const railX = lz >= plazaSplitZ ? endPlazaW * 0.5 - 3.5 : mainPierW * 0.5 - 3.5;
    for (const lx of [-railX, railX]) {
      batcher.addBox('stone_black', 0.4, 5.2, 0.4, lx, deckTopY + 2.6, lz, true);
      batcher.addBox('window_warm', 1.1, 1.1, 1.1, lx, deckTopY + 5.4, lz, true);
    }
  }

  // 1. Pórtico Monumental de Entrada do Píer
  const gateZ = pz(1046);
  batcher.addBox('trim_white', 3.2, 14.5, 3.2, -26, deckTopY + 7.25, gateZ, false);
  batcher.addBox('trim_white', 3.2, 14.5, 3.2, 26, deckTopY + 7.25, gateZ, false);
  batcher.addBox('neon_pink', 56.0, 3.2, 1.8, 0, deckTopY + 14.8, gateZ, false);
  addNeonHotelSign(world, 0, deckTopY + 15.2, gateZ - 1.5, 48, 'PÍER PARQUE ATLÂNTICO ', '#00f0ff', '#fde047');

  // 2. Restaurante Marítimo de 2 Andares com Terraço Panorâmico (X = -28)
  const restX = -28;
  const restZ = pz(1125);
  batcher.addBox('coastal_white', 24, 1.4, 34, restX, deckTopY + 0.7, restZ, false);
  batcher.addBox('glass_cyan', 22.8, 3.6, 32.8, restX, deckTopY + 3.2, restZ, false);
  batcher.addBox('wood_deck', 26, 0.7, 36, restX, deckTopY + 5.35, restZ, false);
  batcher.addBox('coastal_turquoise', 16, 4.4, 20, restX - 3, deckTopY + 7.9, restZ - 4, false);
  batcher.addBox('umb_orange', 18, 0.9, 22, restX - 3, deckTopY + 10.55, restZ - 4, false);
  for (const tz of [restZ + 8, restZ + 14]) {
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, restX + 5, deckTopY + 6.1, tz, true);
    batcher.addBox('umb_red', 3.2, 0.4, 3.2, restX + 5, deckTopY + 8.1, tz, true);
  }
  addNeonHotelSign(world, restX + 12.5, deckTopY + 8.5, restZ, 24, 'RESTAURANTE DO PÍER', '#fb923c', '#ffffff');
  world.addCollider(restX, restZ, 25, 35, deckTopY + 10.5, deckTopY);

  // 3. Fliperama / Arcade Neon 3D (X = +28)
  const arcX = 28;
  const arcZ = pz(1125);
  batcher.addBox('window_warm', 22, 3.6, 32, arcX, deckTopY + 1.8, arcZ, false);
  batcher.addBox('neon_pink', 25, 0.9, 35, arcX, deckTopY + 4.05, arcZ, false);
  batcher.addBox('stone_black', 24, 3.7, 34, arcX, deckTopY + 6.35, arcZ, false);
  batcher.addBox('neon_cyan', 25.4, 0.9, 35.4, arcX, deckTopY + 8.65, arcZ, false);
  addNeonHotelSign(world, arcX - 12.5, deckTopY + 7.2, arcZ, 24, 'MEGA ARCADE LEGO ', '#ec4899', '#00f0ff');
  world.addCollider(arcX, arcZ, 25, 35, deckTopY + 9.2, deckTopY);

  // 4. Oito Barraquinhas Temáticas Coloridas
  const boothZList = [1185, 1225, 1265, 1385].map(pz);
  boothZList.forEach((bz, bIdx) => {
    for (const side of [-1, 1]) {
      const bx = side * 32.0;
      const bColor = UMBRELLA_KEYS[(bIdx * 2 + (side > 0 ? 1 : 0)) % UMBRELLA_KEYS.length];
      batcher.addBox('trim_white', 9.5, 4.2, 9.5, bx, deckTopY + 2.1, bz, false);
      batcher.addBox(bColor, 10.8, 0.95, 10.8, bx, deckTopY + 4.6, bz, false);
      batcher.addBox('trim_white', 7.8, 0.85, 7.8, bx, deckTopY + 5.4, bz, false);
      batcher.addBox('window_warm', 7.2, 1.6, 9.7, bx, deckTopY + 2.5, bz, false);
      if (bIdx % 2 === 0) {
        batcher.addBox('wood_deck', 1.6, 2.2, 1.6, bx, deckTopY + 6.8, bz, true);
        batcher.addBox('umb_pink', 2.6, 2.2, 2.6, bx, deckTopY + 8.6, bz, true);
        batcher.addBox('trim_white', 1.8, 1.4, 1.8, bx, deckTopY + 10.1, bz, true);
      }
      world.addCollider(bx, bz, 9.6, 9.6, deckTopY + 5.6, deckTopY);
    }
  });

  // 6. Carrossel Clássico Giratório 3D (X = -16) — fundido em 1 único MeshStandardMaterial VC!
  const carouselZ = pz(1325);
  const carouselGroup = new THREE.Group();
  carouselGroup.position.set(-16, deckTopY, carouselZ);
  const cEntries = [];
  cEntries.push({ geo: makeTranslatedBox(18, 0.8, 18, 0, 0.4, 0), color: new THREE.Color(LEGO_COLORS.white) });
  const cPillarGeo = new THREE.CylinderGeometry(1.8, 1.8, 8.5, 14);
  cPillarGeo.translate(0, 4.6, 0);
  cEntries.push({ geo: cPillarGeo, color: new THREE.Color(LEGO_COLORS.gold) });
  const cRoofGeo = new THREE.ConeGeometry(11.5, 4.5, 16);
  cRoofGeo.translate(0, 10.2, 0);
  cEntries.push({ geo: cRoofGeo, color: new THREE.Color(0xec4899) });

  for (let h = 0; h < 8; h++) {
    const ang = (h / 8) * Math.PI * 2;
    const hx = Math.cos(ang) * 6.8;
    const hz = Math.sin(ang) * 6.8;
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.14, 7.5, 8);
    poleGeo.translate(hx, 4.4, hz);
    cEntries.push({ geo: poleGeo, color: new THREE.Color(LEGO_COLORS.gold) });

    const mountGeo = new THREE.BoxGeometry(1.4, 1.2, 2.4);
    mountGeo.rotateY(-ang);
    mountGeo.translate(hx, 2.2 + (h % 2) * 0.8, hz);
    cEntries.push({
      geo: mountGeo,
      color: new THREE.Color(h % 2 === 0 ? LEGO_COLORS.white : 0x38bdf8)
    });
  }
  const carouselMergedGeo = mergeColoredGeometries(cEntries);
  carouselMergedGeo.computeBoundingBox();
  carouselMergedGeo.computeBoundingSphere();
  const carouselMesh = new THREE.Mesh(carouselMergedGeo, getSouthBeachStandardVcMat());
  carouselMesh.castShadow = true;
  carouselMesh.receiveShadow = true;
  carouselGroup.add(carouselMesh);
  carouselGroup.userData.skipStaticMerge = true;
  world.scene.add(carouselGroup);
  world.rotatingElements.push({ mesh: carouselGroup, axis: 'y', speed: 0.85 });
  world.addCollider(-16, carouselZ, 18, 18, deckTopY + 12, deckTopY);

  // 7. Torre de Queda Livre "Big Drop" de 58m de altura (X = +24)
  const dropX = 24;
  const dropZ = pz(1325);
  const dropH = 58.0;
  batcher.addBox('umb_red', 5.2, dropH, 5.2, dropX, deckTopY + dropH * 0.5, dropZ, false);
  batcher.addBox('umb_yellow', 6.4, 3.2, 6.4, dropX, deckTopY + dropH, dropZ, false);
  batcher.addBox('neon_cyan', 7.8, 1.8, 7.8, dropX, deckTopY + dropH + 2.2, dropZ, false);
  world.addCollider(dropX, dropZ, 5.4, 5.4, deckTopY + dropH + 3.0, deckTopY);

  // 8. Roda-Gigante 3D Colossal na Praça Funda do Píer (73m 1x, Raio 31m, 16 Cabines!)
  const wheelZ = pz(1480);
  const wheelCenterY = 42.0;
  const wheelRadius = 31.0;
  const cabinCount = 16;

  batcher.addBox('trim_white', 34, 2.6, 52, 0, deckTopY + 1.3, wheelZ, false);
  world.addCollider(0, wheelZ, 34, 52, deckTopY + 2.6, deckTopY);

  // Suportes A-frame estáticos dobrados diretamente no SouthBeachBatcher
  for (const sx of [-7.5, 7.5]) {
    const legA = new THREE.BoxGeometry(2.2, 45, 2.6);
    legA.rotateX(-0.24);
    legA.translate(sx, 23.0, wheelZ - 11.0);
    batcher.addGeometry('trim_white', legA, sx, wheelZ - 11.0, false);

    const legB = new THREE.BoxGeometry(2.2, 45, 2.6);
    legB.rotateX(0.24);
    legB.translate(sx, 23.0, wheelZ + 11.0);
    batcher.addGeometry('trim_white', legB, sx, wheelZ + 11.0, false);

    const hubCap = new THREE.CylinderGeometry(4.0, 4.0, 2.6, 18);
    hubCap.rotateZ(Math.PI / 2);
    hubCap.translate(sx, wheelCenterY, wheelZ);
    batcher.addGeometry('neon_pink', hubCap, sx, wheelZ, false);
  }

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, wheelCenterY, wheelZ);
  wheelGroup.userData.skipStaticMerge = true;

  const wheelStdEntries = [];
  const wheelBasicEntries = [];
  const rimCol = new THREE.Color(0xf8fafc);
  const cyanCol = new THREE.Color(0x00f0ff);
  const goldCol = new THREE.Color(0xfacc15);

  for (const rx of [-3.8, 3.8]) {
    const outerRing = new THREE.TorusGeometry(wheelRadius, 0.85, 10, 44);
    outerRing.rotateY(Math.PI / 2);
    outerRing.translate(rx, 0, 0);
    wheelStdEntries.push({ geo: outerRing, color: rimCol });

    const neonRing = new THREE.TorusGeometry(wheelRadius * 0.72, 0.45, 8, 36);
    neonRing.rotateY(Math.PI / 2);
    neonRing.translate(rx * 0.92, 0, 0);
    wheelBasicEntries.push({ geo: neonRing, color: cyanCol });
  }

  const centerAxle = new THREE.CylinderGeometry(2.6, 2.6, 16.0, 18);
  centerAxle.rotateZ(Math.PI / 2);
  wheelBasicEntries.push({ geo: centerAxle, color: goldCol });

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

  const stdVcMat = getSouthBeachStandardVcMat();
  const basicVcMat = getSouthBeachBasicVcMat();
  const ferrisCabins = [];

  for (let i = 0; i < cabinCount; i++) {
    const angle = (i / cabinCount) * Math.PI * 2;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    for (const rx of [-3.6, 3.6]) {
      const spoke = new THREE.CylinderGeometry(0.26, 0.26, wheelRadius * 2, 6);
      spoke.rotateX(angle);
      spoke.translate(rx, 0, 0);
      wheelStdEntries.push({ geo: spoke, color: rimCol });
    }

    const cabinColor = cabinColors[i % cabinColors.length];
    const cabinGroup = new THREE.Group();
    const cabinMesh = new THREE.Mesh(_getMergedCabinGeometry(cabinColor), stdVcMat);
    cabinMesh.castShadow = false;
    cabinMesh.receiveShadow = true;
    cabinGroup.add(cabinMesh);
    cabinGroup.position.set(0, sinA * wheelRadius, cosA * wheelRadius);
    cabinGroup.userData.skipStaticMerge = true;
    wheelGroup.add(cabinGroup);
    ferrisCabins.push(cabinGroup);
  }

  const wheelStdGeo = mergeColoredGeometries(wheelStdEntries);
  wheelStdGeo.computeBoundingBox();
  wheelStdGeo.computeBoundingSphere();
  const wheelStdMesh = new THREE.Mesh(wheelStdGeo, stdVcMat);
  wheelStdMesh.castShadow = true;
  wheelStdMesh.receiveShadow = true;
  wheelGroup.add(wheelStdMesh);

  const wheelBasicGeo = mergeColoredGeometries(wheelBasicEntries);
  wheelBasicGeo.computeBoundingBox();
  wheelBasicGeo.computeBoundingSphere();
  const wheelBasicMesh = new THREE.Mesh(wheelBasicGeo, basicVcMat);
  wheelBasicMesh.castShadow = false;
  wheelBasicMesh.receiveShadow = false;
  wheelGroup.add(wheelBasicMesh);

  world.scene.add(wheelGroup);
  world.pierOriginZ = pierOriginZ;
  world.pierOffsetZ = pzOff;
  world.ferrisWheelGroup = wheelGroup;
  world.ferrisWheelCabins = ferrisCabins;
  world.ferrisWheelCabinCount = cabinCount;

  // 9. Farol Marítimo Listrado Vermelho e Branco na Ponta Final do Píer (36m 1x)
  const lhZ = pz(1552);
  for (let s = 0; s < 6; s++) {
    const segW = 8.4 - s * 0.7;
    const segColor = s % 2 === 0 ? 'umb_red' : 'trim_white';
    batcher.addBox(segColor, segW, 5.2, segW, 0, deckTopY + s * 5.2 + 2.6, lhZ, false);
  }
  const lanternY = deckTopY + 31.2;
  batcher.addBox('stone_black', 6.5, 0.8, 6.5, 0, lanternY + 0.4, lhZ, false);
  batcher.addBox('window_warm', 4.6, 3.6, 4.6, 0, lanternY + 2.6, lhZ, false);
  batcher.addBox('umb_red', 5.8, 2.2, 5.8, 0, lanternY + 5.2, lhZ, false);
  world.addCollider(0, lhZ, 8.5, 8.5, lanternY + 6.5, deckTopY);

  world.pierData = {
    zStart: pierOriginZ,
    zEnd: pz(1570),
    length: 540,
    width: mainPierW,
    plazaWidth: endPlazaW,
    deckTopY,
    offsetZ: pzOff,
    wheelZ,
    wheelCenterY,
    wheelRadius,
    dropX,
    dropZ,
    carouselX: -16,
    carouselZ,
    coasterStationZ: pz(1235),
    lighthouseZ: lhZ
  };

  // 10. Marina Leste / Rampa Náutica Ampliada com Docas (X = +48..+150, escala 1x)
  const marinaX = 102;
  const marinaZ = pz(1145);

  batcher.addBox('wood_deck', 58, 0.6, 14, 72, 0.45, pz(1085), false);
  batcher.addBox('wood_deck', 12, 0.55, 165, marinaX, 0.15, marinaZ, false);
  world.addCollider(marinaX, marinaZ, 12, 165, 0.8, 0);
  world.mapBlocks.push({ x: marinaX, z: marinaZ, w: 85, d: 165, color: '#b45309' });

  const dockZList = [1095, 1135, 1175, 1215].map(pz);
  dockZList.forEach((dz) => {
    batcher.addBox('wood_deck', 46, 0.45, 5.8, marinaX + 26, 0.1, dz, false);
    batcher.addBox('trim_white', 0.48, 0.9, 0.48, marinaX + 14, 0.55, dz - 2.3, true);
    batcher.addBox('trim_white', 0.48, 0.9, 0.48, marinaX + 38, 0.55, dz - 2.3, true);
  });
}

export function addLegoSpeedboat(batcher, x, yWater, z, hullKey) {
  batcher.addBox('trim_white', 3.4, 0.85, 8.8, x, yWater + 0.3, z, true);
  batcher.addBox(hullKey, 3.55, 0.38, 8.9, x, yWater + 0.52, z, true);
  batcher.addBox('trim_white', 2.4, 0.75, 2.4, x, yWater + 0.35, z + 5.2, true);
  batcher.addBox('glass_cyan', 2.9, 0.75, 1.4, x, yWater + 0.98, z + 1.4, true);
  batcher.addBox('trim_white', 2.4, 0.65, 1.2, x, yWater + 0.82, z - 0.6, true);
  batcher.addBox('stone_black', 1.1, 1.1, 1.1, x, yWater + 0.65, z - 4.6, true);
  batcher.addBox('surf_foam', 4.2, 0.08, 10.6, x, yWater - 0.16, z - 0.6, true);
}

/**
 * 6B. MARINA OESTE COM PÍER DE MADEIRA, CLUBE NÁUTICO & 4 DOCAS DE LANCHAS (X = ws(-1380), escala 1x!)
 */
export function buildWestMarina(world, batcher) {
  const westMarinaX = ws(-1380);
  const mwOffZ = IS_SCALED_WORLD ? ws(1036) - 1030 : 0;
  const clubZ = 1030 + mwOffZ;
  const entryDeckZ = 1032 + mwOffZ;
  const westMarinaZ = 1135 + mwOffZ;

  batcher.addBox('wood_deck', 56, 0.8, 26, westMarinaX, 0.4, entryDeckZ, false);
  batcher.addBox('coastal_white', 38, 1.6, 16, westMarinaX, 1.6, clubZ, false);
  batcher.addBox('glass_cyan', 34, 4.4, 14.8, westMarinaX, 4.6, clubZ, false);
  batcher.addBox('coastal_turquoise', 42, 1.2, 19, westMarinaX, 7.4, clubZ, false);
  addNeonHotelSign(world, westMarinaX, 9.2, clubZ - 9.5, 32, 'MARINA OESTE ', '#06b6d4', '#fde047');
  world.addCollider(westMarinaX, clubZ, 38, 16, 8.5, 0);
  world.mapBuildings.push({
    x: westMarinaX,
    z: clubZ,
    w: 42,
    d: 19,
    height: 9,
    color: '#06b6d4',
    label: 'MARINA OESTE'
  });

  batcher.addBox('wood_deck', 14, 0.65, 185, westMarinaX, 0.25, westMarinaZ, false);
  world.addCollider(westMarinaX, westMarinaZ, 14, 185, 0.9, 0);
  world.mapBlocks.push({ x: westMarinaX, z: westMarinaZ, w: 92, d: 185, color: '#b45309' });

  const westDockZList = [1095, 1135, 1175, 1215].map((dz) => dz + mwOffZ);
  westDockZList.forEach((dz) => {
    batcher.addBox('wood_deck', 48, 0.48, 6.0, westMarinaX + 28, 0.15, dz, false);
    batcher.addBox('trim_white', 0.5, 0.95, 0.5, westMarinaX + 14, 0.6, dz - 2.4, true);
    batcher.addBox('trim_white', 0.5, 0.95, 0.5, westMarinaX + 42, 0.6, dz - 2.4, true);
  });

  world.southwestBeachData = {
    hasSouthwestLighthouse: true,
    lighthousePos: { x: ws(-1735), y: 15.0, z: ws(945), height: 67 },
    hasSandDunes: true,
    dunesCount: 4,
    ...(world.southwestBeachData || {}),
    hasWestMarina: true,
    westMarinaPos: { x: westMarinaX, z: westMarinaZ, clubZ, dockZList: westDockZList, docksCount: westDockZList.length }
  };
}
