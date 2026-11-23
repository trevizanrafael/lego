/**
 * StreetCustomGarage.js — Fachada Fina da Oficina Automotiva "LEGO Customs"
 *
 * Arquitetura modularizada em `src/world/garages/street-customs/`:
 * 1. `CustomsCatalogAndSave.js`
 *    — Catálogo de performance ECU (0–10), paletas de pintura, acabamentos,
 *      decals procedurais em Canvas, bodykits, tetos, escapamentos, películas,
 *      underglow e persistência de slots de garagem (`ACTIVE_GARAGE_SAVE`).
 * 2. `CustomsVehicleApplier3D.js`
 *    — Medição universal de chassis (carros, motos, caminhões e ônibus),
 *      aplicação 3D ao vivo das peças, Monster Truck, Rampa Cunha, neon sub-chassi
 *      e cálculo de atributos físicos reais.
 * 3. `CustomsBuildingAndRuntime3D.js`
 *    — Construção física 3D da oficina Drive-Thru em `X = 60, Z = -448`
 *      (elevador hidráulico, portões abertos, letreiros, terminal de retirada)
 *      e runtime de lançamento parabólico da Rampa Cunha (`StreetCustomsRuntime`).
 * 4. `CustomsStudioModalController.js`
 *    — Showroom interativo 360° (`LegoCustomsStudio`), câmera orbital, abas DOM,
 *      compra de stages/peças em studs, Pay 'n' Spray e retirada dirigindo.
 */

// ----------------------------------------------------------------------------
// 1. Catálogos, Persistência por Slot de Save, Cálculo de Atributos & Decals
// ----------------------------------------------------------------------------
export {
  UPGRADE_LEVEL_COSTS,
  UPGRADE_ATTRIBUTES,
  CUSTOMS_PAINT_PALETTE,
  CUSTOMS_FINISHES,
  CUSTOMS_DECALS,
  CUSTOMS_SPOILERS,
  CUSTOMS_FRONT_MODS,
  CUSTOMS_WHEEL_STYLES,
  CUSTOMS_ROOF_MODS,
  CUSTOMS_EXHAUST_MODS,
  CUSTOMS_WINDOW_TINTS,
  CUSTOMS_UNDERGLOW,
  createDefaultGarageSaveData,
  getActiveGarageSaveData,
  setActiveGarageSaveData,
  getPaletteHex,
  DEFAULT_TUNING,
  createDefaultVehicleTuning,
  computeTunedVehicleStats,
  createVehicleDecalTexture
} from './garages/street-customs/CustomsCatalogAndSave.js';

// ----------------------------------------------------------------------------
// 2. Aplicação 3D de Peças, Pintura, Películas, Monster Truck & Underglow RGB
// ----------------------------------------------------------------------------
export {
  measureVehicleBounds,
  applyWindowAndHeadlightTint,
  applyTuningToVehicleObject,
  updateVehicleDynamicTuningFX,
  getVehicleCustomFlameHex
} from './garages/street-customs/CustomsVehicleApplier3D.js';

// ----------------------------------------------------------------------------
// 3. Prédio 3D da Oficina Drive-Thru, Spawn de Veículos & Física Rampa Cunha
// ----------------------------------------------------------------------------
export {
  StreetCustomsRuntime,
  resolveLegoCustomsAnchor,
  buildLegoCustomsGarage,
  spawnDraggableCustomVehicle
} from './garages/street-customs/CustomsBuildingAndRuntime3D.js';

// ----------------------------------------------------------------------------
// 4. Controlador de Câmera Orbital 360° & UI DOM do Estúdio "LEGO Customs"
// ----------------------------------------------------------------------------
export {
  LegoCustomsStudio
} from './garages/street-customs/CustomsStudioModalController.js';
