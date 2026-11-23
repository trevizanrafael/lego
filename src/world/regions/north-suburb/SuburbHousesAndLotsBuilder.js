import * as THREE from 'three';
import { LEGO_COLORS } from '../../../materials/LegoMaterials.js';
import {
  HOUSE_STYLE_KEYS,
  buildDetailedHouse
} from '../../SuburbHouseGenerator.js';
import {
  ROAD,
  DESIGN_MAIN_AVENUES_X,
  ws
} from '../../core/WorldLayoutScale.js';

const SUBURB_GRID_DESIGN_X = [-648, -516, -384, -252, -120, 0, 120, 252, 384, 516];
const MAIN_X_SET = new Set(DESIGN_MAIN_AVENUES_X);
const SCALED_ROW_Z_PAIRS = [
  { dzNorth: -644, dzSouth: -512, hasUrbanSidewalk: true },
  { dzNorth: -776, dzSouth: -644, hasUrbanSidewalk: true },
  { dzNorth: -908, dzSouth: -776, hasUrbanSidewalk: true },
  { dzNorth: -1040, dzSouth: -908, hasUrbanSidewalk: true },
  { dzNorth: -1172, dzSouth: -1040, hasUrbanSidewalk: true },
  { dzNorth: -1308, dzSouth: -1172, hasUrbanSidewalk: false }
];

function halfRoadForDesignX(dx) {
  return (MAIN_X_SET.has(dx) ? ROAD.mainWidth : ROAD.secondaryWidth) * 0.5;
}

/**
 * Malha de gramado adaptativa ao relevo contínuo do Platô Norte (zero degrau / zero Z-fighting
 * sobre o miolo de +0.14m de `UrbanSidewalkAndBlockBuilder`).
 */
export function addSuburbTerrainLawnSlab(world, batcher, minX, maxX, minZ, maxZ, yLift = 0.04) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w <= 1 || d <= 1) return;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const yNW = tAt(minX, minZ);
  const yNE = tAt(maxX, minZ);
  const ySW = tAt(minX, maxZ);
  const ySE = tAt(maxX, maxZ);
  const yC = tAt(cx, cz);

  if (Math.max(yNW, yNE, ySW, ySE, yC) - Math.min(yNW, yNE, ySW, ySE, yC) < 0.03) {
    batcher.addBox('lawn_green', w, 0.06, d, cx, yC + yLift, cz);
    return;
  }

  const segX = Math.max(2, Math.min(14, Math.ceil(w / 28)));
  const segZ = Math.max(2, Math.min(14, Math.ceil(d / 28)));
  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, tAt(vx, vz) + yLift);
  }
  geo.computeVertexNormals();
  batcher.addCustomGeo('lawn_green', geo);
}

/**
 * Em `WORLD_SCALE > 1`: constrói uma fileira de lotes residenciais em tamanho `1x` (`lotW` ~38..52m,
 * `lotD` ~32m) ancorada exatamente na borda interna da calçada de 10m (`frontEdgeZ`), sem invadir
 * calçadas nem ruas de 34m/26m!
 */
export function buildScaledSuburbStreetFrontRow(world, batcher, cfg) {
  const {
    minX,
    maxX,
    frontEdgeZ,
    lotD = 32,
    facingDirZ = 1,
    lotsCount = 6,
    seed = 1,
    isSouthBorderRow = false,
    isNorthCoastRow = false,
    recordLots = 6
  } = cfg;

  const spanW = maxX - minX;
  if (spanW < 28) return;
  const safeCount = Math.max(2, Math.min(lotsCount, Math.floor(spanW / 32)));
  const lotW = spanW / safeCount;
  const lotCenterZ = frontEdgeZ - facingDirZ * (lotD * 0.5);

  world.suburbBlocks.push({
    x: (minX + maxX) * 0.5,
    z: lotCenterZ,
    w: spanW,
    d: lotD,
    innerW: spanW,
    innerD: lotD,
    totalLots: recordLots,
    isSouthBorderRow
  });

  for (let i = 0; i < safeCount; i++) {
    const lotX = minX + (i + 0.5) * lotW;
    const lotSeed = seed * 17 + i * 5 + Math.floor(Math.random() * 100);
    let styleKey = HOUSE_STYLE_KEYS[Math.floor(Math.random() * 4)];
    if (isSouthBorderRow) {
      styleKey = 'townhouses';
    } else if (isNorthCoastRow) {
      styleKey = i % 2 === 0 ? 'suburb_mansion_pool' : 'modern_wood_chalet';
    } else if (i === 0 && seed % 3 === 0) {
      styleKey = 'suburb_mansion_pool';
    } else if (i === safeCount - 1 && seed % 4 === 0) {
      styleKey = 'modern_wood_chalet';
    }

    buildDetailedHouse(world, batcher, {
      x: lotX,
      z: lotCenterZ,
      lotW,
      lotD,
      facingDirZ,
      styleKey,
      seed: lotSeed
    });
  }

  // Postes residenciais aconchegantes recuados na borda interna do lote (fora da calçada de 10m!)
  for (const lx of [minX + 3.0, maxX - 3.0]) {
    const lz = frontEdgeZ - facingDirZ * 0.9;
    const lampBaseY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(lx, lz) : 0) + 0.06;
    batcher.addBox('charcoal_metal', 0.24, 3.6, 0.24, lx, lampBaseY + 1.8, lz);
    batcher.addBox('window_warm', 0.52, 0.48, 0.52, lx, lampBaseY + 3.7, lz);
  }
}

/**
 * Constrói um Quarteirão Residencial com Borda de Calçada, Interior 100% Grama Verde Viva
 * e Divisão Simétrica em 4, 6 ou 8 Lotes com cercas, garagens (driveways), caminhos e quintais detalhados.
 */
export function buildResidentialSuburbBlock(
  world,
  batcher,
  bx,
  bz,
  bw,
  bd,
  seed,
  isSouthBorderRow,
  isNorthCoastRow = false
) {
  const S = 3;
  const innerW = bw - S * 2;
  const innerD = bd - S * 2;
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(bx, bz) : 0;

  // 1. Calçada de concreto externa + Alicerce de Arrimo em Ladeira + Gramado Verde Vivo em todo o interior!
  world._addCityBlockSidewalk(bx, bz, bw, bd, LEGO_COLORS.sidewalk, baseY);
  if (baseY > 0.15) {
    batcher.addBox('stone_grey', bw + 0.3, 8.5, bd + 0.3, bx, baseY - 4.25, bz);
  }
  batcher.addBox('lawn_green', innerW, 0.08, innerD, bx, baseY + 0.28, bz);
  world.mapBlocks.push({
    x: bx,
    z: bz,
    w: innerW,
    d: innerD,
    color: '#22c55e'
  });

  // 2. Define a quantidade simétrica de lotes no quarteirão: 4, 6 ou 8 lotes (2, 3 ou 4 por face Norte/Sul)
  const lotsPerRow =
    isSouthBorderRow || isNorthCoastRow ? 2 : seed % 3 === 0 ? 4 : seed % 2 === 0 ? 3 : 2;
  const totalLots = lotsPerRow * 2;
  const lotW = innerW / lotsPerRow;
  const lotD = innerD * 0.5;

  world.suburbBlocks.push({
    x: bx,
    z: bz,
    w: bw,
    d: bd,
    innerW,
    innerD,
    totalLots,
    isSouthBorderRow
  });

  for (let i = 0; i < lotsPerRow; i++) {
    const lotX = bx - innerW * 0.5 + (i + 0.5) * lotW;

    // Lote Sul (virado de frente para a rua Sul, facingDirZ = +1)
    const southSeed = seed * 13 + i * 3 + Math.floor(Math.random() * 100);
    let southStyle = HOUSE_STYLE_KEYS[Math.floor(Math.random() * 4)];
    if (isSouthBorderRow) {
      // Na fronteira sul do Subúrbio (perto do Centro), usa Townhouses geminados de 3 andares!
      southStyle = 'townhouses';
    } else if (lotsPerRow === 2 && i === 0 && seed <= 4) {
      southStyle = 'suburb_mansion_pool';
    }

    buildDetailedHouse(world, batcher, {
      x: lotX,
      z: bz + lotD * 0.5,
      lotW,
      lotD,
      facingDirZ: 1,
      styleKey: southStyle,
      seed: southSeed
    });

    // Lote Norte (virado de frente para a rua Norte, facingDirZ = -1)
    const northSeed = seed * 17 + i * 5 + Math.floor(Math.random() * 100);
    let northStyle = HOUSE_STYLE_KEYS[Math.floor(Math.random() * 4)];
    if (isNorthCoastRow) {
      northStyle = i === 0 ? 'suburb_mansion_pool' : 'modern_wood_chalet';
    } else if (lotsPerRow === 3 && i === 1 && seed <= 6) {
      northStyle = 'modern_wood_chalet';
    }

    buildDetailedHouse(world, batcher, {
      x: lotX,
      z: bz - lotD * 0.5,
      lotW,
      lotD,
      facingDirZ: -1,
      styleKey: northStyle,
      seed: northSeed
    });
  }

  // Postes residenciais aconchegantes mais baixos nas esquinas da calçada
  for (const cx of [bx - innerW * 0.46, bx + innerW * 0.46]) {
    for (const cz of [bz - innerD * 0.5 - 2.2, bz + innerD * 0.5 + 2.2]) {
      const lampBaseY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0) + 0.28;
      batcher.addBox('charcoal_metal', 0.24, 3.6, 0.24, cx, lampBaseY + 1.8, cz);
      batcher.addBox('window_warm', 0.52, 0.48, 0.52, cx, lampBaseY + 3.7, cz);
    }
  }
}

/**
 * Adiciona Townhouses de 3 andares nas extremidades Leste/Oeste da faixa de transição (Z = -448)
 */
export function buildTransitionTownhouseAccents(world, batcher) {
  for (const tx of [-582]) {
    const bw = 104;
    const bd = 96;
    const transTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, -448) : 0;
    world._addCityBlockSidewalk(tx, -448, bw, bd, LEGO_COLORS.sidewalk);
    batcher.addBox('lawn_green', bw - 10, 0.08, bd - 10, tx, transTY + 0.28, -448);

    buildDetailedHouse(world, batcher, {
      x: tx - 22,
      z: -448 + 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: 1,
      styleKey: 'townhouses',
      seed: tx < 0 ? 101 : 202
    });
    buildDetailedHouse(world, batcher, {
      x: tx + 22,
      z: -448 + 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: 1,
      styleKey: 'townhouses',
      seed: tx < 0 ? 103 : 204
    });
    buildDetailedHouse(world, batcher, {
      x: tx - 22,
      z: -448 - 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: -1,
      styleKey: 'american_two_story',
      seed: tx < 0 ? 105 : 206
    });
    buildDetailedHouse(world, batcher, {
      x: tx + 22,
      z: -448 - 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: -1,
      styleKey: 'suburb_mansion_pool',
      seed: tx < 0 ? 107 : 208
    });
  }
}

/**
 * Orquestra toda a malha residencial e os 3 quarteirões especiais do Subúrbio Norte em `WORLD_SCALE > 1`,
 * ancorando lotes `1x` nas calçadas reais de 10m sem sobrepor nenhuma via de 34m/26m.
 */
export function buildScaledNorthSuburbGrid(world, batcher, specialBuilders) {
  const {
    buildExplosiveGasStationBlock,
    buildSuburbCommercialPizzeriaBlock,
    buildSuburbParkAndBasketballBlock
  } = specialBuilders;
  const sw = ROAD.sidewalk;
  let blockCounter = 0;

  for (let rIdx = 0; rIdx < SCALED_ROW_Z_PAIRS.length; rIdx++) {
    const { dzNorth, dzSouth, hasUrbanSidewalk } = SCALED_ROW_Z_PAIRS[rIdx];
    const isSouthBorderRow = rIdx === 0;
    const isNorthCoastRow = rIdx === 5;
    const bMinZ = hasUrbanSidewalk ? ws(dzNorth) + ROAD.secondaryWidth * 0.5 : ws(-1315) + 12;
    const bMaxZ = ws(dzSouth) - ROAD.secondaryWidth * 0.5;
    const innerMinZ = bMinZ + sw;
    const innerMaxZ = bMaxZ - sw;

    for (let cIdx = 0; cIdx < SUBURB_GRID_DESIGN_X.length - 1; cIdx++) {
      const dx0 = SUBURB_GRID_DESIGN_X[cIdx];
      const dx1 = SUBURB_GRID_DESIGN_X[cIdx + 1];
      const designMidX = (dx0 + dx1) * 0.5;
      const bMinX = ws(dx0) + halfRoadForDesignX(dx0);
      const bMaxX = ws(dx1) - halfRoadForDesignX(dx1);
      const innerMinX = bMinX + sw;
      const innerMaxX = bMaxX - sw;
      const cellCX = (innerMinX + innerMaxX) * 0.5;

      if (!hasUrbanSidewalk) {
        world._addCityBlockSidewalk(
          (bMinX + bMaxX) * 0.5,
          (bMinZ + bMaxZ) * 0.5,
          bMaxX - bMinX,
          bMaxZ - bMinZ,
          LEGO_COLORS.sidewalk
        );
      }

      const safeSouthZ = cIdx === 0 && rIdx === 0 ? Math.min(innerMaxZ, ws(-526)) : innerMaxZ;
      addSuburbTerrainLawnSlab(world, batcher, innerMinX, innerMaxX, innerMinZ, safeSouthZ);
      world.mapBlocks.push({
        x: cellCX,
        z: (innerMinZ + safeSouthZ) * 0.5,
        w: innerMaxX - innerMinX,
        d: safeSouthZ - innerMinZ,
        color: '#22c55e'
      });

      if (rIdx === 1 && designMidX === 186) {
        const gx = Math.min(innerMaxX - 62, Math.max(innerMinX + 62, ws(204)));
        const gz = innerMinZ + 56;
        buildExplosiveGasStationBlock(world, batcher, gx, gz, 122, 122, {
          skipSidewalkSlab: true,
          facingDirZ: -1,
          frontSidewalkInnerZ: innerMinZ
        });
        blockCounter++;
        buildScaledSuburbStreetFrontRow(world, batcher, {
          minX: innerMinX + 2.5,
          maxX: innerMaxX - 2.5,
          frontEdgeZ: safeSouthZ,
          lotD: 32,
          facingDirZ: 1,
          lotsCount: 6,
          seed: blockCounter * 2,
          isSouthBorderRow: false,
          isNorthCoastRow: false,
          recordLots: 6
        });
        continue;
      }

      if (rIdx === 1 && designMidX === 60) {
        buildSuburbCommercialPizzeriaBlock(world, batcher, innerMaxX - 55, safeSouthZ - 56, 110, 122, {
          skipSidewalkSlab: true
        });
        blockCounter++;
        buildScaledSuburbStreetFrontRow(world, batcher, {
          minX: innerMinX + 2.5,
          maxX: innerMaxX - 2.5,
          frontEdgeZ: innerMinZ,
          lotD: 32,
          facingDirZ: -1,
          lotsCount: 6,
          seed: blockCounter * 2,
          isSouthBorderRow: false,
          isNorthCoastRow: false,
          recordLots: 4
        });
        continue;
      }

      if (rIdx === 1 && designMidX === -60) {
        buildSuburbParkAndBasketballBlock(world, batcher, innerMaxX - 55, safeSouthZ - 56, 110, 122, {
          skipSidewalkSlab: true
        });
        blockCounter++;
        buildScaledSuburbStreetFrontRow(world, batcher, {
          minX: innerMinX + 2.5,
          maxX: innerMaxX - 2.5,
          frontEdgeZ: innerMinZ,
          lotD: 32,
          facingDirZ: -1,
          lotsCount: 6,
          seed: blockCounter * 2,
          isSouthBorderRow: false,
          isNorthCoastRow: false,
          recordLots: 8
        });
        continue;
      }

      if (isNorthCoastRow && (designMidX === -186 || designMidX === 318)) {
        buildSuburbParkAndBasketballBlock(world, batcher, cellCX, safeSouthZ - 62, 122, 124, {
          skipSidewalkSlab: true
        });
        blockCounter++;
        buildScaledSuburbStreetFrontRow(world, batcher, {
          minX: innerMinX + 2.5,
          maxX: innerMaxX - 2.5,
          frontEdgeZ: innerMinZ,
          lotD: 34,
          facingDirZ: -1,
          lotsCount: 6,
          seed: blockCounter * 2,
          isSouthBorderRow: false,
          isNorthCoastRow: true,
          recordLots: 6
        });
        continue;
      }

      blockCounter++;
      const lotsCount = isSouthBorderRow || isNorthCoastRow ? 6 : blockCounter % 3 === 0 ? 8 : 7;
      const recSouth = blockCounter % 3 === 0 ? 8 : blockCounter % 2 === 0 ? 6 : 4;
      const recNorth = (blockCounter + 1) % 3 === 0 ? 8 : (blockCounter + 1) % 2 === 0 ? 6 : 4;

      buildScaledSuburbStreetFrontRow(world, batcher, {
        minX: innerMinX + 2.5,
        maxX: innerMaxX - 2.5,
        frontEdgeZ: safeSouthZ,
        lotD: 32,
        facingDirZ: 1,
        lotsCount,
        seed: blockCounter * 2 - 1,
        isSouthBorderRow,
        isNorthCoastRow: false,
        recordLots: recSouth
      });

      buildScaledSuburbStreetFrontRow(world, batcher, {
        minX: innerMinX + 2.5,
        maxX: innerMaxX - 2.5,
        frontEdgeZ: innerMinZ,
        lotD: isNorthCoastRow ? 34 : 32,
        facingDirZ: -1,
        lotsCount,
        seed: blockCounter * 2,
        isSouthBorderRow: false,
        isNorthCoastRow,
        recordLots: recNorth
      });
    }
  }

  const promZ = ws(-1315);
  const promMinX = ws(-642);
  const promMaxX = ws(518);
  const promW = promMaxX - promMinX;
  const promCX = (promMinX + promMaxX) * 0.5;
  world._addCityBlockSidewalk(promCX, promZ, promW, 10, LEGO_COLORS.sidewalk);
  addSuburbTerrainLawnSlab(world, batcher, promMinX + 3, promMaxX - 3, promZ - 4, promZ + 4, 0.30);
  world.mapBlocks.push({ x: promCX, z: promZ, w: promW - 6, d: 8, color: '#22c55e' });
  for (let tx = promMinX + 16; tx <= promMaxX - 16; tx += 36) {
    const ty = (world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, promZ) : 0) + 0.32;
    world._addLegoTree(tx, ty, promZ, 1.05);
  }
}
