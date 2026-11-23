/**
 * ============================================================================
 * REGIÃO 3 (SUL) — BAÍA CURVA, CALÇADÃO EM ONDAS PORTUGUESAS & MEGA PÍER
 * ============================================================================
 *
 * Fachada fina de orquestração da Orla Sul (`SouthBeachBuilder.js`).
 * Toda a geometria, batching Vertex-Color + LOD e marcos costeiros vivem
 * nos submódulos especializados dentro de `./south-beach/`:
 *
 * 1. `BeachBatcherAndConstants.js`:
 *    - Curva analítica suave da baía (`getSouthBeachBayOffsetZ`), constantes
 *      dos 3 Canais de Santos (`SANTOS_CANALS_X`), `SouthBeachBatcher` unificado
 *      em 2 materiais Vertex-Color compartilhados + chunks `THREE.LOD` de 2 níveis
 *      (`720m`, `L0 = 0m` / `L1 = 280m`) e helpers de coqueiros curvos e neon.
 *
 * 2. `BeachfrontSkyscrapersBuilder.js` + `CoastalOrganicBlocksFiller.js`:
 *    - 8 super-arranha-céus frontais exclusivos (`232m–296m`) com recuo orgânico
 *      acompanhando a baía, escalonamento gradual (`45–110m` na 2ª quadra e
 *      `16–38m` nas travessas costeiras com cafés/surf shops) e 3 níveis de LOD.
 *
 * 3. `BoardwalkCanalsAndSandBuilder.js`:
 *    - 3 Canais estilo Santos, calçadão curvo contínuo em ondas de pedras
 *      portuguesas, ciclovia vermelha, mureta da orla, chuveirinhos/pérgolas,
 *      faixa curva de areia dourada/úmida/espuma, salva-vidas, vôlei, 16 castelos
 *      quebráveis e Costão Sudoeste (Farol de 67m + Dunas).
 *
 * 4. `MegaPierAndMarinaBuilder.js`:
 *    - Quiosques acompanhando a curva do calçadão, Mega Píer Parque Atlântico
 *      (`540m`), Carrossel, Big Drop (`58m`), Roda-Gigante (`16` cabines) e
 *      Marinas Leste e Oeste sem malhas plásticas avulsas.
 * ============================================================================
 */

import {
  DESIGN_SANTOS_CANALS_X,
  SANTOS_CANALS_X,
  getSouthBeachBayOffsetZ,
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

export { DESIGN_SANTOS_CANALS_X, SANTOS_CANALS_X, getSouthBeachBayOffsetZ };

/**
 * Constrói toda a Região Sul (Baía Curva, Arranha-Céus Escalonados, 3 Canais
 * de Santos, Calçadão Português, Areia Dourada, Mega Píer de 540m com
 * Roda-Gigante Colossal, Costão/Farol Sudoeste e Marinas Leste/Oeste).
 */
export function buildSouthBeachAndFerrisWheel(world) {
  const batcher = new SouthBeachBatcher();

  world.southBeachHotels = [];
  world.beachSandcastles = [];
  world.santosCanals = [];
  world.southBeachHotelLODs = [];
  world.southBeachBatchLODs = [];
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
  world.southBeachBatchLODs = batcher.flush(world.scene);
}
