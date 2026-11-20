import { LEGO_COLORS } from '../../../materials/LegoMaterials.js';
import {
  HOUSE_STYLE_KEYS,
  buildDetailedHouse
} from '../../SuburbHouseGenerator.js';

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
