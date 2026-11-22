/**
 * Fachada fina da Região Norte — Bairro Residencial / Subúrbio.
 * Delega os lotes residenciais (4/6/8 casas com grama, telhados inclinados, quintais e cercas)
 * para `./north-suburb/SuburbHousesAndLotsBuilder.js` e os quarteirões especiais (Praça, Quadra,
 * Pizzaria/Diner e Posto de Gasolina com 6 bombas explosivas) para
 * `./north-suburb/SuburbPlazaPizzeriaAndGasBuilder.js`.
 */
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { SuburbBatcher } from '../SuburbHouseGenerator.js';
import { IS_SCALED_WORLD } from '../core/WorldLayoutScale.js';
import {
  buildResidentialSuburbBlock,
  buildScaledNorthSuburbGrid,
  buildTransitionTownhouseAccents
} from './north-suburb/SuburbHousesAndLotsBuilder.js';
import {
  buildExplosiveGasStationBlock,
  buildSuburbCommercialPizzeriaBlock,
  buildSuburbParkAndBasketballBlock
} from './north-suburb/SuburbPlazaPizzeriaAndGasBuilder.js';

/**
 * 4. NORTE — BAIRRO RESIDENCIAL / SUBÚRBIO (LOTES DE GRAMA, 5 ESTILOS DE CASAS, QUINTAIS E 3 QUARTEIRÕES ESPECIAIS)
 */
export function buildNorthSuburbAndGasStation(world) {
  const batcher = new SuburbBatcher();
  world.suburbBlocks = [];

  if (IS_SCALED_WORLD) {
    buildScaledNorthSuburbGrid(world, batcher, {
      buildExplosiveGasStationBlock,
      buildSuburbCommercialPizzeriaBlock,
      buildSuburbParkAndBasketballBlock
    });
    batcher.flush(world.scene);
    return;
  }

  const suburbBlockRowsZ = [-580, -712, -844, -976, -1108, -1240];
  const suburbBlockColsX = [-582, -450, -318, -186, -60, 60, 186, 318, 450];

  let blockCounter = 0;
  for (let rIdx = 0; rIdx < suburbBlockRowsZ.length; rIdx++) {
    const bz = suburbBlockRowsZ[rIdx];
    const isSouthBorderRow = rIdx === 0; // bz = -580 (Fronteira Sul do Subúrbio com o Centro)

    // Registra a rua residencial estreita (10m) que corta os quarteirões ao meio no mapa
    world.mapRoads.push({ x: -53.5, z: bz, w: 1179, d: 10, isMain: false });

    for (let cIdx = 0; cIdx < suburbBlockColsX.length; cIdx++) {
      const bx = suburbBlockColsX[cIdx];
      const bw = Math.abs(bx) === 60 ? 110 : 122;
      const bd = 122;

      // Os 3 Quarteirões Especiais Obrigatórios na faixa central do Subúrbio (bz = -712):
      if (bz === -712 && bx === 186) {
        buildExplosiveGasStationBlock(world, batcher, bx, bz, bw, bd);
        continue;
      }
      if (bz === -712 && bx === 60) {
        buildSuburbCommercialPizzeriaBlock(world, batcher, bx, bz, bw, bd);
        continue;
      }
      if (bz === -712 && bx === -60) {
        buildSuburbParkAndBasketballBlock(world, batcher, bx, bz, bw, bd);
        continue;
      }
      // Na última fileira costeira Norte (bz = -1240), inclui Parques Arborizados em bx = -186 e bx = 318
      if (bz === -1240 && (bx === -186 || bx === 318)) {
        buildSuburbParkAndBasketballBlock(world, batcher, bx, bz, bw, 134);
        continue;
      }

      // Divide cada célula de 122m em 2 Quarteirões Residenciais Compactos separados por rua de 10m
      blockCounter++;
      const isNorthCoastRow = bz === -1240;
      const northSubD = isNorthCoastRow ? 68 : 56;
      const northSubZ = isNorthCoastRow ? bz - 39 : bz - 33;
      buildResidentialSuburbBlock(world, batcher, bx, bz + 33, bw, 56, blockCounter * 2 - 1, isSouthBorderRow, false);
      buildResidentialSuburbBlock(world, batcher, bx, northSubZ, bw, northSubD, blockCounter * 2, false, isNorthCoastRow);
    }
  }

  // Parque Linear & Alameda Arborizada na Borda Extrema Norte (Z = -1315, no Platô Costeiro Elevado)
  const northPromenadeY = world.getTerrainHeightAt ? world.getTerrainHeightAt(0, -1315) : 0;
  world._addCityBlockSidewalk(-53.5, -1315, 1179, 10, LEGO_COLORS.sidewalk, northPromenadeY);
  batcher.addBox('lawn_green', 1173, 0.1, 8, -53.5, northPromenadeY + 0.28, -1315);
  world.mapBlocks.push({ x: -53.5, z: -1315, w: 1173, d: 8, color: '#22c55e' });
  for (let tx = -610; tx <= 515; tx += 32) {
    const ty = (world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, -1315) : 0) + 0.32;
    world._addLegoTree(tx, ty, -1315, 1.05);
  }

  // Townhouses elegantes nos cantos da faixa de transição (Z = -448)
  buildTransitionTownhouseAccents(world, batcher);

  // Mescla todas as geometrias estáticas do Subúrbio em poucos Draw Calls e instancia as Árvores Floridas!
  batcher.flush(world.scene);
}
