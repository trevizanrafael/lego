/**
 * PARQUE CENTRAL & GRANDE LAGO (`CentralParkBuilder.js`)
 * =============================================================================
 * Fachada fina de orquestração da Floresta Urbana / Parque Central da Metrópole
 * (X: -490..+490, Z: +152..+384), integrando muralhas clássicas com studs,
 * alamedas e fonte monumental, Grande Lago navegável e selva densa (550+ árvores).
 *
 * Submódulos (`src/world/regions/downtown/`):
 *   - `CentralParkGatesAndPlaza.js` — Batcher espacial do parque, mureta de pedra
 *     e tijolo com pinos LEGO, 4 Portões Monumentais, rede de trilhas/alamedas,
 *     Praça Circular Central com Chafariz em 3 camadas + studs e 3 Coretos.
 *   - `CentralParkLakeAndNature.js` — Grande Lago com shader de água animada,
 *     margens rochosas, píer de madeira, Ponte Arqueada Clássica (passagem por
 *     cima e por baixo), 6 carrinhos quebráveis e floresta densa de 550+ árvores.
 */

import { LEGO_COLORS, createLegoBrick } from '../../materials/LegoMaterials.js';
import {
  createParkBatcher,
  buildStonePerimeterWallsAndGates,
  buildPavedPathsCentralPlazaAndFountain
} from './downtown/CentralParkGatesAndPlaza.js';
import {
  buildBreakableParkFoodCarts,
  buildGrandLakeBoatsAndArchedBridge,
  buildDenseJungleForestVegetation
} from './downtown/CentralParkLakeAndNature.js';

export function buildCentralParkAndLake(world) {
  const px = 0;
  const pz = 268;
  const pw = 980; // X: -490..+490
  const pd = 232; // Z: +152..+384
  const groundY = 0.34;

  // Calçada Externa Perimetral contornando todo o Parque junto às avenidas (994m x 244m)
  world._addCityBlockSidewalk(px, pz, pw + 14, pd + 12, LEGO_COLORS.sidewalk);

  // Gramado Verde Vibrante Principal cobrindo todo o Parque Central
  const parkGrass = createLegoBrick(pw, groundY, pd, 0x15803d, {
    studs: false,
    roughness: 0.52
  });
  parkGrass.position.set(px, groundY * 0.5, pz);
  world.scene.add(parkGrass);
  world.mapBlocks.push({ x: px, z: pz, w: pw, d: pd, color: '#15803d' });

  // Batcher dedicado de materiais para manter 60 FPS cravados
  const batcher = createParkBatcher();

  // 1. Perímetro de Mureta de Pedra/Tijolo com Studs no topo, Postes de Ferro e 4 Portões Clássicos
  buildStonePerimeterWallsAndGates(world, batcher, px, pz, pw, pd, groundY);

  // 2. Rede Completa de Caminhos/Trilhas, Praça Circular, Fonte de 3 Camadas, Gazebos, Bancos e Carrinhos
  buildPavedPathsCentralPlazaAndFountain(world, batcher, px, pz, pw, pd, groundY);
  buildBreakableParkFoodCarts(world, groundY);

  // 3. O Grande Lago Navegável, Bordas de Rochas, Píer & Ponte Arqueada Clássica
  buildGrandLakeBoatsAndArchedBridge(world, batcher, px, pz, groundY);

  // 4. Selva / Floresta Urbana Densa (550+ Árvores Gigantes, Cipós, Samambaias, Rochas e Flores)
  buildDenseJungleForestVegetation(world, batcher, px, pz, pw, pd, groundY);

  // Finaliza e adiciona todas as geometrias agrupadas por material na cena
  batcher.flush(world.scene);

  // Metadados do Parque Central para validação e testes automatizados
  world.centralParkData = {
    x: px,
    z: pz,
    width: pw,
    depth: pd,
    gatesCount: 4,
    fountainPos: { x: 0, z: pz },
    lakeCenter: { x: 205, z: pz, width: 270, depth: 162 },
    bridgeCenter: { x: 205, z: pz, archClearanceY: 3.6, deckTopY: 4.35 },
    gazebosCount: 3,
    breakableFoodCartsCount: 6,
    treeCount: batcher.treeCount,
    undergrowthCount: batcher.undergrowthCount
  };
}
