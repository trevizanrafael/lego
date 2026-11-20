/**
 * ============================================================================
 * ViaductAndReliefBuilder.js — Fachada Modular de Relevo Urbano & Viadutos Expressos
 * ============================================================================
 *
 * Ponto de entrada unificado que preserva 100% da API pública histórica de
 * `ViaductAndReliefBuilder.js`, delegando as funções matemáticas de topografia,
 * as formações naturais 3D e a rede de viadutos suspensos para submódulos
 * especializados em `src/world/terrain/`:
 *
 *  1. `terrain/UrbanReliefFunctions.js`:
 *     - Funções matemáticas contínuas de relevo urbano:
 *       • `getNorthSuburbPlateauY`: ladeiras e Mirante Costeiro Norte (+22.0m)
 *       • `getNorthwestDowntownHillY`: colinas urbanas NW/NE (+15.0m / +14.8m)
 *       • `getEastDowntownBelaVistaHillY`: colina Bela Vista Leste (+9.6m)
 *       • `getSouthCoastalRidgeY`: crista panorâmica rumo à Praia Sul (+10.5m)
 *       • `getCentralParkWestHillsY`: colinas e Mirante do Parque (+14.0m)
 *       • `getEastIndustrialElevationY`: platô industrial Leste (+7.5m)
 *       • `getSouthwestBeachReliefY`: dunas e pontais rochosos SW (+8.5m)
 *       • `getUrbanCityReliefY`: composição geral com máscaras `keepout` em Y=0m
 *         protegendo Super Banco Central, portais do Metrô, Torre dos Heróis e Lago.
 *
 *  2. `terrain/NaturalReliefMeshesBuilder.js`:
 *     - Batcher dedicado de materiais/sombras e construção das falésias Norte,
 *       colinas gramadas em terraços, Mirante Circular com lunetas/bancos/studs,
 *       dunas costeiras Sudoeste e muros de arrimo do Cânion CDD.
 *
 *  3. `terrain/ViaductDeckAndSupports.js`:
 *     - Extrusão contínua de tabuleiros rodoviários (`addContinuousDeck`),
 *       pórticos estruturais sobre calçadas (`addViaductSupports`) e pórticos
 *       aéreos de sinalização expressa (`addOverheadHighwayGantry`).
 *
 *  4. `terrain/ExpressViaductsBuilder.js`:
 *     - Orquestração completa (`buildViaductsAndNaturalRelief`), construção dos
 *       3 grandes viadutos expressos suspensos (+12.4m de vão livre) e rampas
 *       centrais de acesso na Av. X = 0 rumo ao Centro Financeiro / Super Banco.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Funções Matemáticas de Topografia & Relevo Urbano Contínuo
// ----------------------------------------------------------------------------
export {
  getNorthSuburbPlateauY,
  getNorthwestDowntownHillY,
  getEastDowntownBelaVistaHillY,
  getSouthCoastalRidgeY,
  getCentralParkWestHillsY,
  getEastIndustrialElevationY,
  getSouthwestBeachReliefY,
  getUrbanCityReliefY
} from './terrain/UrbanReliefFunctions.js';

// ----------------------------------------------------------------------------
// 2. Construtor Integrado de Relevo Natural 3D & Rede de 3 Viadutos Expressos
// ----------------------------------------------------------------------------
export {
  buildViaductsAndNaturalRelief
} from './terrain/ExpressViaductsBuilder.js';
