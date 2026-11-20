import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick } from '../../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../../BuildingGenerator.js';
import {
  UMBRELLA_KEYS,
  SANTOS_CANALS_X,
  CANAL_WIDTH,
  isInsideSantosCanal,
  addCurvedLegoPalmTree,
  addNeonHotelSign
} from './BeachBatcherAndConstants.js';

/**
 * 2. OS 3 CANAIS ESTILO SANTOS (Canal 1, Canal 2 e Canal 3):
 * Descem da Avenida Beira-Mar (Z = 720), cortam o Calçadão e dividem a Areia da Praia até desaguar no Oceano (Z = 1068)!
 */
export function buildSantosStyleBeachCanals(world, batcher) {
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

/**
 * 3. AVENIDA BEIRA-MAR & CALÇADÃO DE COQUEIROS (Cortado pelas Pontes dos 3 Canais)
 */
export function buildOceanfrontBoardwalk(world, batcher) {
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
}

/**
 * 4. FAIXA EXTENSA DE AREIA DOURADA (SEPARADA EM 4 PRAIAS PELOS 3 CANAIS DE SANTOS E ESTENDIDA ATÉ X = -1825!)
 */
export function buildGoldenBeachAndShorelineLife(world, batcher) {
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
 * 6A. PONTA DA PRAIA / COSTÃO SUDOESTE — FAROL MARÍTIMO (X = -1735, Z = 945, 67m) & DUNAS DE AREIA COM COQUEIROS
 */
export function buildSouthwestPointLighthouseAndDunes(world, batcher) {
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

  world.southwestBeachData = {
    hasSouthwestLighthouse: true,
    lighthousePos: { x: lhX, y: baseTopY, z: lhZ, height: 67 },
    hasSandDunes: true,
    dunesCount: duneClusters.length,
    hasWestMarina: false,
    westMarinaPos: null
  };
}
