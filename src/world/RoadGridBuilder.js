/**
 * ============================================================================
 * RoadGridBuilder.js — Fachada Modular de Oceano, Ilha Continental & Malha Viária
 * ============================================================================
 *
 * Ponto de entrada unificado que preserva 100% da API pública histórica de
 * `RoadGridBuilder.js`, delegando a construção do oceano, massas continentais,
 * rodovias inter-regionais e malha viária urbana para submódulos coesos em
 * `src/world/terrain/`:
 *
 *  1. `terrain/BridgeAndPierSpecs.js`:
 *     - Especificações oficiais das 9 pontes em arco sobre o Rio Urbano Leste
 *       (`RIVER_BRIDGE_SPECS`), da Ponte Boreal do Fiorde (`PANGAEA_BRIDGE_SPECS`)
 *       e dos 3 píeres/marinas fluviais (`RIVER_PIER_SPECS`), além dos helpers
 *       de subdivisão topográfica e flush em chunks com origem local (precisão
 *       Float32 em grandes distâncias).
 *
 *  2. `terrain/OceanAndPangaeaMeshBuilder.js`:
 *     - Construção das placas do Oceano Atlântico (±14.500m) estritamente fora
 *       da terra firme e dos recortes subterrâneos do metrô, shader animado de
 *       água, Ilha Continental Principal, Península Industrial Leste, chunks
 *       heightfield da Pangeia, anéis costeiros de areia, arquipélago, cadeia
 *       de montanhas no horizonte e divisas visuais entre regiões
 *       (`buildOceanAndMainIsland`).
 *
 *  3. `terrain/PangaeaHighwaysAndLandmarks.js`:
 *     - Rodovias inter-regionais (`PANGAEA_HIGHWAYS`), iluminação rodoviária
 *       instanciada, pórticos sinalizados de fronteira e os 4 marcos regionais
 *       da Pangeia (Estação Boreal Norte, Radar Costeiro Noroeste, Parque
 *       Eólico/Refinaria de Tétis e Vila das Dunas Sudoeste).
 *
 *  4. `terrain/UrbanRoadGridAndBridges.js`:
 *     - Geração das avenidas principais Norte-Sul e Leste-Oeste, ruas
 *       secundárias, vias táticas industriais, canteiros centrais arborizados,
 *       faixas de pedestres e semáforos 3D adaptados continuamente a
 *       `getUrbanCityReliefY(x, z)` (`buildUrbanRoadGridAndMedians`).
 *
 * Regra de Arquitetura:
 *  - Reexporta 100% dos símbolos originais sem dependências circulares.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Especificações Oficiais de Pontes em Arco & Píeres Fluviais
// ----------------------------------------------------------------------------
export {
  RIVER_BRIDGE_SPECS,
  PANGAEA_BRIDGE_SPECS,
  RIVER_PIER_SPECS
} from './terrain/BridgeAndPierSpecs.js';

// ----------------------------------------------------------------------------
// 2. Oceano Atlântico, Ilha Continental Principal, Península Leste & Pangeia
// ----------------------------------------------------------------------------
export {
  buildOceanAndMainIsland
} from './terrain/OceanAndPangaeaMeshBuilder.js';

// ----------------------------------------------------------------------------
// 3. Malha Viária Urbana, Canteiros Arborizados, Cruzamentos & Semáforos 3D
// ----------------------------------------------------------------------------
export {
  buildUrbanRoadGridAndMedians
} from './terrain/UrbanRoadGridAndBridges.js';
