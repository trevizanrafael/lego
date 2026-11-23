import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick } from '../../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../../BuildingGenerator.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
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
 * Descem da Avenida Beira-Mar, cortam o Calçadão e dividem a Areia da Praia até desaguar no Oceano (largura 1x)!
 */
export function buildSantosStyleBeachCanals(world, batcher) {
  SANTOS_CANALS_X.forEach((cx, idx) => {
    const canalNum = idx + 1;
    const canalZStart = ws(724);
    const canalZEnd = ws(1066);
    const canalLen = canalZEnd - canalZStart;
    const canalCenterZ = (canalZStart + canalZEnd) * 0.5;

    // 1. Leito de Água Azul-Profundo do Canal correndo da Avenida até o Mar!
    batcher.addBox('canal_water', CANAL_WIDTH - 2.4, 0.35, canalLen, cx, -0.18, canalCenterZ);
    world.mapWater.push({ x: cx, z: canalCenterZ, w: CANAL_WIDTH, d: canalLen });

    // 2. Paredões Laterais de Concreto & Muretas Brancas/Azuis Clássicas de Santos
    const leftWallX = cx - CANAL_WIDTH * 0.5;
    const rightWallX = cx + CANAL_WIDTH * 0.5;
    const footbridgeZ = ws(910);
    const bridgeZStart = IS_SCALED_WORLD ? ws(724) : 726;
    const bridgeZEnd = ws(778);
    const bridgeDepth = bridgeZEnd - bridgeZStart;
    const bridgeCenterZ = (bridgeZStart + bridgeZEnd) * 0.5;
    const bikeZ = IS_SCALED_WORLD ? ws(726) + 5 : 731;

    const p1Start = IS_SCALED_WORLD ? bridgeZEnd + 1.5 : 727.5;
    const p1End = IS_SCALED_WORLD ? footbridgeZ - 8.5 : 892.5;
    const p1Len = p1End - p1Start;
    const p1CenterZ = (p1Start + p1End) * 0.5;

    const p2Start = IS_SCALED_WORLD ? footbridgeZ + 8.5 : 925;
    const p2End = ws(1045);
    const p2Len = p2End - p2Start;
    const p2CenterZ = (p2Start + p2End) * 0.5;

    for (const wx of [leftWallX, rightWallX]) {
      batcher.addBox('stone_grey', 1.8, 1.4, canalLen, wx, 0.1, canalCenterZ);
      // Mureta de proteção superior (interrompida apenas na ponte do calçadão e na passarela da areia)
      batcher.addBox('trim_white', 0.85, 0.85, p1Len, wx, 0.95, p1CenterZ);
      batcher.addBox('umb_blue', 0.9, 0.22, p1Len, wx, 1.38, p1CenterZ);
      batcher.addBox('trim_white', 0.85, 0.85, p2Len, wx, 0.95, p2CenterZ);
      batcher.addBox('umb_blue', 0.9, 0.22, p2Len, wx, 1.38, p2CenterZ);
    }

    // 3. Ponte do Calçadão & Ciclovia sobre o Canal com Balaustrada Branca
    batcher.addBox('stone_white', CANAL_WIDTH + 4, 0.48, bridgeDepth, cx, 0.24, bridgeCenterZ);
    batcher.addBox('bike_red', CANAL_WIDTH + 4, 0.06, 4.6, cx, 0.54, bikeZ);
    batcher.addBox('trim_white', CANAL_WIDTH + 4, 1.1, 0.6, cx, 0.8, bridgeZStart + 0.5);
    batcher.addBox('trim_white', CANAL_WIDTH + 4, 1.1, 0.6, cx, 0.8, bridgeZEnd - 0.5);

    // 4. Passarela Arqueada de Pedestres & Buggies no Meio da Areia (Z = ws(910), largura 14m 1x!)
    batcher.addBox('wood_deck', CANAL_WIDTH + 6, 0.55, 14, cx, 0.45, footbridgeZ);
    batcher.addBox('trim_white', CANAL_WIDTH + 6, 1.0, 0.45, cx, 1.1, footbridgeZ - 6.8);
    batcher.addBox('trim_white', CANAL_WIDTH + 6, 1.0, 0.45, cx, 1.1, footbridgeZ + 6.8);

    // 5. Molhes de Pedra na Boca do Canal entrando nas ondas do mar
    const jettyZ = IS_SCALED_WORLD ? ws(1055) : 1058;
    const jettyLen = IS_SCALED_WORLD ? 54 : 32;
    const foamZ = IS_SCALED_WORLD ? ws(1066) : 1068;
    batcher.addBox('stone_black', 3.4, 1.5, jettyLen, leftWallX, 0.25, jettyZ);
    batcher.addBox('stone_black', 3.4, 1.5, jettyLen, rightWallX, 0.25, jettyZ);
    batcher.addBox('surf_foam', CANAL_WIDTH + 8, 0.16, 8, cx, -0.14, foamZ);

    // Placa Identificadora "CANAL 1 / 2 / 3" junto ao Calçadão
    addNeonHotelSign(world, cx, 3.6, ws(726) + 1, 14, `CANAL ${canalNum}`, '#38bdf8', '#ffffff');

    world.santosCanals.push({ canalNum, x: cx, width: CANAL_WIDTH, zStart: canalZStart, zEnd: canalZEnd });
  });
}

/**
 * 3. AVENIDA BEIRA-MAR & CALÇADÃO DE COQUEIROS (Cortado pelas Pontes dos 3 Canais)
 */
export function buildOceanfrontBoardwalk(world, batcher) {
  const bwZStart = ws(726);
  const bwZEnd = ws(778);
  const bwDepth = bwZEnd - bwZStart;
  const bwZ = (bwZStart + bwZEnd) * 0.5;
  const bikeZ = IS_SCALED_WORLD ? bwZStart + 5 : 731;

  // Em 3x: Calçada Sul de 10m + esplanada conectando o meio-fio sul da Av. Beira-Mar (Z = ws(710) + 17) ao Calçadão (ws(726))
  if (IS_SCALED_WORLD) {
    const aveSouthCurbZ = ws(710) + ROAD.mainWidth * 0.5;
    const apronDepth = bwZStart - aveSouthCurbZ;
    if (apronDepth > 0.5) {
      const apronW = ws(538) - ws(-1825);
      const apronCX = (ws(-1825) + ws(538)) * 0.5;
      const apronCZ = (aveSouthCurbZ + bwZStart) * 0.5;
      batcher.addBox('stone_grey', apronW, ROAD.curbHeight, apronDepth, apronCX, ROAD.curbHeight * 0.5, apronCZ);
    }
  }

  // Calçadão dividido em 4 trechos entre os 3 Canais (terminando em X = ws(538) na Foz do Rio Urbano!)
  const segmentsX = [
    [ws(-1825), SANTOS_CANALS_X[0] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[0] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[1] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[1] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[2] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[2] + CANAL_WIDTH * 0.5, ws(538)]
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

    batcher.addBox('bike_red', segW, 0.05, 4.6, segCenterX, 0.365, bikeZ);
    batcher.addBox('trim_white', segW, 0.06, 0.25, segCenterX, 0.38, bikeZ - 2.4);
    batcher.addBox('trim_white', segW, 0.06, 0.25, segCenterX, 0.38, bikeZ + 2.4);
  }

  // Padrão de Pedras Portuguesas em Ondas Pretas e Brancas sem interseção coplanar com o piso
  const waveStep = IS_SCALED_WORLD ? 42 : 16;
  const waveBoxW = IS_SCALED_WORLD ? 34.0 : 14.0;
  for (let wx = ws(-1800); wx <= ws(528); wx += waveStep) {
    if (isInsideSantosCanal(wx, IS_SCALED_WORLD ? 14 : 4)) continue;
    const waveOffset = Math.sin(wx * (IS_SCALED_WORLD ? 0.025 : 0.06)) * (IS_SCALED_WORLD ? 8.5 : 4.5);
    batcher.addBox('stone_black', waveBoxW, 0.04, 3.6, wx, 0.36, bwZ - (IS_SCALED_WORLD ? 28 : 6) + waveOffset);
    batcher.addBox('stone_black', waveBoxW, 0.04, 3.6, wx, 0.36, bwZ + (IS_SCALED_WORLD ? 28 : 8) - waveOffset);
  }

  // Coqueiros curvos e bancos ao longo do Calçadão (escala 1x e contagem enxuta 60 FPS!)
  const palmStep = IS_SCALED_WORLD ? 96 : 36;
  const palmNorthZ = IS_SCALED_WORLD ? bwZStart + 16 : 738;
  const palmSouthZ = IS_SCALED_WORLD ? bwZEnd - 8 : 772;
  const benchZ = IS_SCALED_WORLD ? bwZEnd - 3.5 : 774.5;
  for (let px = ws(-1780); px <= ws(516); px += palmStep) {
    if (Math.abs(px) < 52 || isInsideSantosCanal(px, 12)) continue;
    const leanX = ((Math.round(px) % 3) - 1) * 0.22;
    addCurvedLegoPalmTree(batcher, px, 0.32, palmNorthZ, leanX, 0.82, 1.12);
    if (Math.abs(Math.round(px)) % (palmStep * 2) === 0) {
      addCurvedLegoPalmTree(batcher, px + 12, 0.32, palmSouthZ, -leanX, 0.9, 1.18);
    }
    batcher.addBox('trim_white', 3.4, 0.55, 0.9, px + 8, 0.58, benchZ);
    batcher.addBox('wood_deck', 3.4, 0.55, 0.22, px + 8, 0.95, benchZ - 0.4);
  }
}

/**
 * 4. FAIXA EXTENSA DE AREIA DOURADA (SEPARADA EM 4 PRAIAS PELOS 3 CANAIS DE SANTOS E ESTENDIDA ATÉ X = ws(-1825)!)
 */
export function buildGoldenBeachAndShorelineLife(world, batcher) {
  const beachSegmentsX = [
    [ws(-1825), SANTOS_CANALS_X[0] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[0] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[1] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[1] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[2] - CANAL_WIDTH * 0.5],
    [SANTOS_CANALS_X[2] + CANAL_WIDTH * 0.5, ws(538)]
  ];

  const sandDepth = ws(258);
  const sandCenterZ = ws(907);
  const wetSandZ = ws(1044);
  const wetSandD = IS_SCALED_WORLD ? 48 : 18;
  const surfFoamZ = ws(1054);
  const surfFoamD = IS_SCALED_WORLD ? 6.0 : 3.2;

  // Constrói os 4 trechos de Areia Dourada separados pelos 3 Canais e terminando na Foz do Rio Urbano (X = ws(538))!
  for (const [xStart, xEnd] of beachSegmentsX) {
    const segW = xEnd - xStart;
    const segCenterX = (xStart + xEnd) * 0.5;
    const sandSeg = createLegoBrick(segW, 0.28, sandDepth, 0xb89f72, {
      studs: false,
      roughness: 0.74
    });
    sandSeg.position.set(segCenterX, -0.02, sandCenterZ);
    world.scene.add(sandSeg);
    world.mapBlocks.push({ x: segCenterX, z: sandCenterZ, w: segW, d: sandDepth, color: '#b89f72' });

    batcher.addBox('sand_wet', segW, 0.22, wetSandD, segCenterX, -0.12, wetSandZ);
    batcher.addBox('surf_foam', segW, 0.14, surfFoamD, segCenterX, -0.16, surfFoamZ);
  }

  const sandY = 0.12;
  const volleyXList = [-460, -210, 165, 340].map(ws);
  const volleyZ = ws(865);
  const lifeguardXList = [-250, 185].map(ws);
  const lifeguardZ = ws(905);

  // Guarda-Sóis Listrados, Espreguiçadeiras e Toalhas em escala 1x e contagem controlada (~1.2x em 3x para 60 FPS!)
  const rowsZ = IS_SCALED_WORLD ? [ws(815), ws(865), ws(940), ws(995)] : [815, 865, 925, 980];
  for (let r = 0; r < rowsZ.length; r++) {
    const rz = rowsZ[r];
    let ux = ws(-1620);
    while (ux <= ws(515)) {
      const stepX = IS_SCALED_WORLD ? (Math.abs(ux) <= 450 ? 64 : 132) : 48;
      const curX = ux;
      ux += stepX;

      if (Math.abs(curX) < 54 || isInsideSantosCanal(curX, 18)) continue;
      if (curX >= ws(-1560) && curX <= ws(-1060) && rz >= ws(830) && rz <= ws(975)) continue;
      if (Math.abs(rz - volleyZ) < 16 && volleyXList.some((vx) => Math.abs(curX - vx) < 26)) {
        continue;
      }
      if (Math.abs(rz - lifeguardZ) < 16 && lifeguardXList.some((lx) => Math.abs(curX - lx) < 18)) {
        continue;
      }

      const jitterX = curX + ((r * 17 + Math.round(curX)) % 11) - 5;
      const jitterZ = rz + ((Math.round(curX) * 7) % 9) - 4;
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

  // 2 Postos / Torres de Salva-Vidas (tamanho 1x, longe dos canais!)
  for (const lx of lifeguardXList) {
    const ly = Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(lx, lifeguardZ) : sandY);
    buildLifeguardTower(world, batcher, lx, ly, lifeguardZ);
  }

  // 4 Redes de Vôlei de Praia entre os canais (tamanho 1x!)
  for (const vx of volleyXList) {
    const vy = Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(vx, volleyZ) : sandY);
    buildBeachVolleyballCourt(batcher, vx, vy, volleyZ);
  }

  // 16 Castelos de Areia de LEGO Quebráveis espalhados pelas 4 faixas de praia!
  const castlePositions = [
    [-440, 955], [-310, 995], [-275, 945], [-210, 1005],
    [-85, 935], [-68, 990], [-58, 845], [-175, 975],
    [62, 975], [75, 845], [95, 990], [145, 935],
    [195, 1005], [305, 945], [355, 995], [420, 955]
  ];
  for (const [dcx, dcz] of castlePositions) {
    const cx = ws(dcx);
    const cz = ws(dcz);
    const cy = Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : sandY);
    spawnBreakableSandcastle(world, cx, cy, cz);
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
 * 6A. PONTA DA PRAIA / COSTÃO SUDOESTE — FAROL MARÍTIMO (X = ws(-1735), Z = ws(945), 67m 1x!) & DUNAS DE AREIA COM COQUEIROS
 */
export function buildSouthwestPointLighthouseAndDunes(world, batcher) {
  // 1. COSTÃO ROCHOSO SUDOESTE & FAROL MARÍTIMO VERMELHO E BRANCO DE LEGO (tamanho e altura 67m em 1x!)
  const lhX = ws(-1735);
  const lhZ = ws(945);

  // Promontório de rochas costeiras escuras escalonadas na Ponta Sudoeste
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

  // 2. DUNAS DE AREIA DOURADA COM COQUEIROS & PISTA DE BUGGY (tamanho e altura em 1x!)
  const duneClusters = [
    { x: ws(-1510), z: ws(875), w: 96, d: 58, h: 4.8 },
    { x: ws(-1395), z: ws(915), w: 112, d: 64, h: 6.2 },
    { x: ws(-1275), z: ws(868), w: 104, d: 56, h: 5.4 },
    { x: ws(-1155), z: ws(908), w: 98, d: 62, h: 4.6 }
  ];
  for (const d of duneClusters) {
    const groundY = Math.max(0, world.getTerrainHeightAt ? world.getTerrainHeightAt(d.x, d.z) : 0);
    batcher.addBox('coastal_sun', d.w, d.h * 0.45, d.d, d.x, groundY + d.h * 0.22, d.z);
    batcher.addBox('sand_wet', d.w * 0.68, d.h * 0.4, d.d * 0.68, d.x, groundY + d.h * 0.62, d.z);
    batcher.addBox('coastal_sun', d.w * 0.38, d.h * 0.32, d.d * 0.38, d.x, groundY + d.h * 0.92, d.z);
    addCurvedLegoPalmTree(batcher, d.x - d.w * 0.22, groundY + d.h * 0.65, d.z - 6, -0.22, 0.85, 1.15);
    addCurvedLegoPalmTree(batcher, d.x + d.w * 0.22, groundY + d.h * 0.65, d.z + 6, 0.24, 0.82, 1.1);
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
