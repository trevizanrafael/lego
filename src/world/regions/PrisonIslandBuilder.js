/**
 * ============================================================================
 * REGIÃO 6 (SUDESTE) — GRANDE PONTE BLINDADA & ILHA DA PRISÃO DE SEGURANÇA MÁXIMA
 * ============================================================================
 *
 * Fachada fina de orquestração da Ilha da Prisão (`PrisonIslandBuilder.js`).
 * Toda a geometria PBR sombria, cabos estaiados, celas e minifiguras batched
 * estão divididos nos submódulos especializados dentro de `./prison-island/`:
 *
 * 1. `PrisonBatcherAndBridgeBuilder.js`:
 *    - `PrisonIslandBatcher` (24 materiais táticos PBR/emissivos com chunking
 *      espacial de 768m e cabos orientados por `Quaternion.setFromUnitVectors`),
 *      telemetria inicial (`world.prisonIslandData`), helpers de placas e
 *      minifiguras LEGO estáticas, mais a Grande Ponte Blindada Estaiada de
 *      390m (X = 1375, Z = 735..1125) e as 2 guaritas/bloqueios do BOPE.
 *
 * 2. `PrisonWallsAndTowersBuilder.js`:
 *    - Plataforma rochosa de 840m x 860m, quebra-mar costeiro, Doca Naval
 *      externa da Guarda Costeira com guindaste de 38m, Muralha Perimetral de
 *      40m com Portão Monumental Norte, 8 Torres de Vigia de 68m com holofotes,
 *      Duplo Heliponto Policial de cobertura e os 4 setores internos do pátio
 *      (quadras, academia, refeitório externo, comboios, subestação e caixas d'água).
 *
 * 3. `PrisonCellBlocksAndHQBuilder.js`:
 *    - Cidadela Panóptica Central "A Balsa" (126m) com 4 skybridges blindados
 *      em Y = 40m e os 6 Pavilhões Penitenciários Altos (58m a 82m), incluindo
 *      a Ala de Contenção Ômega Laser (domínio A.R.E.S.), celas térreas visíveis
 *      de CV/PCC, Administração/Arsenal do BOPE com Sallie Port e Hospital.
 * ============================================================================
 */

import {
  PrisonIslandBatcher,
  createInitialPrisonIslandData,
  buildArmoredCableStayedBridgeAndCheckpoints
} from './prison-island/PrisonBatcherAndBridgeBuilder.js';
import {
  buildPrisonIslandPerimeterWallsAndCoastGuardDock,
  buildFourInternalCourtyardSectors
} from './prison-island/PrisonWallsAndTowersBuilder.js';
import {
  buildCentralPanopticonCitadelAndSkybridges,
  buildSixTallPenitentiaryPavilions
} from './prison-island/PrisonCellBlocksAndHQBuilder.js';

/**
 * Constrói a Grande Ponte Blindada Estaiada (com cabos corrigidos e guaritas do BOPE)
 * e toda a Ilha da Prisão de Segurança Máxima ("A Balsa", 840m x 860m).
 */
export function buildSoutheastPrisonIsland(world) {
  const batcher = new PrisonIslandBatcher();
  world.prisonIslandData = createInitialPrisonIslandData();

  // 1. Grande Ponte Blindada Estaiada (X = 1375, Z = 735..1125) + 2 Checkpoints/Guaritas do BOPE
  buildArmoredCableStayedBridgeAndCheckpoints(world, batcher);

  // 2. Ilha 840m x 860m, Doca Naval da Guarda Costeira, Muralha de 40m e 8 Torres de Vigia (68m)
  buildPrisonIslandPerimeterWallsAndCoastGuardDock(world, batcher);

  // 3. Cidadela Panóptica Central ("A Balsa" — 126m, Duplo Heliponto e 4 Skybridges em Y=40m)
  buildCentralPanopticonCitadelAndSkybridges(world, batcher);

  // 4. Os 6 Pavilhões Penitenciários Altos (58m–82m) com Contenção Ômega Laser (A.R.E.S.) e Celas Visíveis
  buildSixTallPenitentiaryPavilions(world, batcher);

  // 5. Os 4 Setores Internos do Pátio (Passarelas de Ronda, Quadras, Academia, Comboios, Subestação e Água)
  buildFourInternalCourtyardSectors(world, batcher);

  batcher.flush(world.scene);
}
