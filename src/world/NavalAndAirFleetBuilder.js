/**
 * NavalAndAirFleetBuilder.js — Fachada fina da Frota Naval & Aérea LEGO 3D
 *
 * Orquestra e reexporta a arquitetura modularizada em `src/world/vehicles/*`:
 * - `NavalFleetBuilder.js`: pedalinhos cisne, barcos do lago, jet-skis, lanchas e Guarda Costeira/BOPE.
 * - `AircraftFleetBuilder.js`: helicópteros policiais/ataque, jatos VIP, caças supersônicos,
 *   aviões comerciais, `NAVAL_AIR_SPECS` e `buildBoatsAndAircraftFleet`.
 *
 * Ao ser importado, registra automaticamente `NAVAL_AIR_SPECS` em `VEHICLE_SPECS`.
 */

import {
  NAVAL_BOAT_TYPES,
  NAVAL_SPECS,
  COLOSSAL_AND_PORT_SPECS,
  LAKE_AND_MARINA_BOAT_PLACEMENTS,
  COAST_GUARD_BOAT_PLACEMENTS,
  resolveNavalBoatPlacements,
  buildNavalBoatMesh
} from './vehicles/NavalFleetBuilder.js';

import {
  AIRCRAFT_SPECS,
  NAVAL_AIR_SPECS,
  buildHelicopterMesh,
  buildJetAircraftMesh,
  buildCommercialAirlinerMesh,
  createNavalOrAircraftMesh,
  resolveAircraftPlacements,
  buildBoatsAndAircraftFleet
} from './vehicles/AircraftFleetBuilder.js';

import {
  attachExhaustFlames,
  createNavalAirMaterialContext
} from './vehicles/VehicleChassisPrimitives.js';

/**
 * Alias de compatibilidade nominal para o catálogo completo de embarcações e aeronaves.
 */
const NAVAL_AND_AIR_SPECS = NAVAL_AIR_SPECS;

export {
  NAVAL_AIR_SPECS,
  NAVAL_AND_AIR_SPECS,
  NAVAL_SPECS,
  AIRCRAFT_SPECS,
  COLOSSAL_AND_PORT_SPECS,
  NAVAL_BOAT_TYPES,
  LAKE_AND_MARINA_BOAT_PLACEMENTS,
  COAST_GUARD_BOAT_PLACEMENTS,
  resolveNavalBoatPlacements,
  resolveAircraftPlacements,
  attachExhaustFlames,
  createNavalAirMaterialContext,
  buildNavalBoatMesh,
  buildHelicopterMesh,
  buildJetAircraftMesh,
  buildCommercialAirlinerMesh,
  createNavalOrAircraftMesh,
  buildBoatsAndAircraftFleet
};
