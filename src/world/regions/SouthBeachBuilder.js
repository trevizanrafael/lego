/**
 * ============================================================================
 * REGIÃO 3 (SUL) — ORLA COSTEIRA, CANAIS DE SANTOS, MEGA PÍER & RODA-GIGANTE
 * ============================================================================
 *
 * Fachada fina de orquestração da Orla Sul (`SouthBeachBuilder.js`).
 * Toda a geometria, materiais PBR/emissivos e sistemas de LOD estão divididos
 * nos submódulos especializados dentro de `./south-beach/`:
 *
 * 1. `BeachBatcherAndConstants.js`:
 *    - Constantes costeiras (`SANTOS_CANALS_X`, `CANAL_WIDTH`, paletas tropicais
 *      e de guarda-sóis), `SouthBeachBatcher` com chunking espacial (768m) e
 *      helpers compartilhados de coqueiros LEGO curvos e letreiros neon.
 *
 * 2. `BeachfrontSkyscrapersBuilder.js`:
 *    - Os 8 super-arranha-céus exclusivos da orla (232m a 296m) + torres da
 *      Quadra Mar e Orla Oeste com 3 níveis de LOD (`BeachTowerBuilder`),
 *      texturas diurnas/noturnas com mipmaps, varandas limpas sem Z-fighting,
 *      térreo comercial e registro em `world.southBeachEmissiveMats`.
 *
 * 3. `BoardwalkCanalsAndSandBuilder.js`:
 *    - Os 3 Canais estilo Santos com pontes e passarelas, Avenida Beira-Mar e
 *      calçadão em ondas portuguesas, 4 praias de areia dourada, guarda-sóis,
 *      salva-vidas, quadras de vôlei, castelos quebráveis e Costão Sudoeste
 *      (Farol de 67m + Dunas de Areia com Coqueiros).
 *
 * 4. `MegaPierAndMarinaBuilder.js`:
 *    - Os 8 quiosques da orla, Mega Píer Parque Atlântico (540m mar adentro),
 *      Restaurante 2 andares, Arcade Neon, barraquinhas, Carrossel giratório,
 *      Torre Big Drop (58m), Roda-Gigante colossal (16 cabines) e Marinas
 *      Leste e Oeste.
 * ============================================================================
 */

import {
  SANTOS_CANALS_X,
  SouthBeachBatcher
} from './south-beach/BeachBatcherAndConstants.js';
import {
  buildCoastalHotelBlocks,
  registerBeachEmissiveMaterials
} from './south-beach/BeachfrontSkyscrapersBuilder.js';
import {
  buildSantosStyleBeachCanals,
  buildOceanfrontBoardwalk,
  buildGoldenBeachAndShorelineLife,
  buildSouthwestPointLighthouseAndDunes
} from './south-beach/BoardwalkCanalsAndSandBuilder.js';
import {
  buildOceanfrontKiosks,
  buildMonumentalPierFerrisWheelAndMarina,
  buildWestMarina
} from './south-beach/MegaPierAndMarinaBuilder.js';

export { SANTOS_CANALS_X };

/**
 * Constrói toda a Região Sul (Orla de Arranha-Céus em 3 níveis de LOD, 3 Canais
 * estilo Santos, Calçadão, Quiosques, Areia Dourada, Mega Píer de 540m com
 * Roda-Gigante Colossal, Costão/Farol Sudoeste e Marinas Leste/Oeste).
 */
export function buildSouthBeachAndFerrisWheel(world) {
  const batcher = new SouthBeachBatcher();

  world.southBeachHotels = [];
  world.beachSandcastles = [];
  world.santosCanals = [];
  world.southBeachHotelLODs = [];
  world.southBeachEmissiveMats = [];

  buildCoastalHotelBlocks(world, batcher);
  buildSantosStyleBeachCanals(world, batcher);
  buildOceanfrontBoardwalk(world, batcher);
  buildOceanfrontKiosks(world, batcher);
  buildGoldenBeachAndShorelineLife(world, batcher);
  buildMonumentalPierFerrisWheelAndMarina(world, batcher);
  buildSouthwestPointLighthouseAndDunes(world, batcher);
  buildWestMarina(world, batcher);

  registerBeachEmissiveMaterials(world);
  batcher.flush(world.scene);
}
