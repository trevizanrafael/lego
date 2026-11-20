/**
 * AircraftCustomGarage.js — Fachada Fina do Hangar de Customização Aérea
 *
 * Arquitetura modularizada em `src/world/garages/aircraft-customs/`:
 * 1. `AircraftCatalogAndApplier.js`
 *    — Catálogo de aeronaves do hangar (caças supersônicos, jato stealth VIP e
 *      helicópteros táticos), padrões de pintura/camuflagem, insígnias de
 *      esquadrão, números de cauda, armamentos sob pilones, asas/radar AWACS,
 *      propulsores de pós-combustão, persistência por tipo e sincronização
 *      automática com o Aeroporta-Aviões (`applySavedAircraftConfigsToCarrier`).
 * 2. `AircraftStudioModalController.js`
 *    — Estúdio 3D orbital no hangar do Aeroporta-Aviões (`AircraftCustomStudio`),
 *      presets de câmera (`front`, `wing`, `tail`, `top`), teste ao vivo de
 *      turbinas/rotores, persistência no save e lançamento direto ao convés.
 *
 * @typedef {Object} AircraftCustomConfig
 * @property {string} aircraftType - `'jato_caca' | 'jato_vip' | 'heli_ataque' | 'heli_policia'`
 * @property {string} primaryColor - ID da cor primária da fuselagem
 * @property {string} secondaryColor - ID da cor secundária e detalhes
 * @property {string} wingColor - ID da cor das asas e cauda
 * @property {string} finishStyle - Estilo de acabamento PBR (`glossy`, `matte`, etc.)
 * @property {string} windowTint - Película da cabine
 * @property {string} pattern - Padrão de pintura/camuflagem
 * @property {string} insignia - Insígnia de esquadrão
 * @property {string} tailNumber - Número tático de cauda
 * @property {string} weaponMod - Módulo de armamento sob pilones
 * @property {string} wingMod - Módulo aerodinâmico de asas/radar
 * @property {string} thrusterMod - Módulo de propulsão e pós-combustão
 */

// ----------------------------------------------------------------------------
// 1. Catálogos Estáticos de Aeronaves, Camuflagens, Insígnias & Módulos 3D
// ----------------------------------------------------------------------------
export {
  AIRCRAFT_STUDIO_TYPES,
  AIRCRAFT_PATTERNS,
  AIRCRAFT_INSIGNIAS,
  AIRCRAFT_TAIL_NUMBERS,
  AIRCRAFT_WEAPON_MODS,
  AIRCRAFT_WING_MODS,
  AIRCRAFT_THRUSTER_MODS
} from './garages/aircraft-customs/AircraftCatalogAndApplier.js';

// ----------------------------------------------------------------------------
// 2. Estado Persistente por Slot de Save & Cálculo de Atributos de Voo
// ----------------------------------------------------------------------------
export {
  createDefaultAircraftConfig,
  createDefaultAircraftSaveData,
  getActiveAircraftSaveData,
  setActiveAircraftSaveData,
  computeCustomAircraftStats
} from './garages/aircraft-customs/AircraftCatalogAndApplier.js';

// ----------------------------------------------------------------------------
// 3. Aplicação 3D de Liveries/Armamentos & Sincronização no Aeroporta-Aviões
// ----------------------------------------------------------------------------
export {
  applyAircraftCustomization,
  applySavedAircraftConfigsToCarrier,
  spawnCustomizedCarrierAircraft
} from './garages/aircraft-customs/AircraftCatalogAndApplier.js';

// ----------------------------------------------------------------------------
// 4. Controlador de Câmera Orbital & UI DOM do Estúdio Aéreo no Hangar
// ----------------------------------------------------------------------------
export {
  AircraftCustomStudio
} from './garages/aircraft-customs/AircraftStudioModalController.js';
