/**
 * VehicleFleetBuilder.js — Fachada fina da Frota Terrestre LEGO 3D ("Gotham Noir")
 *
 * Orquestra e reexporta a arquitetura modularizada em `src/world/vehicles/*`:
 * - `VehicleSpecsCatalog.js`: `KMH_TO_UNITS`, `UNITS_TO_KMH`, `VEHICLE_SPECS` e metadados de grupos.
 * - `VehicleChassisPrimitives.js`: geometrias hard-surface studless, cabines fumê, rodas e chamas.
 * - `CivilianAndSportsCarsBuilder.js`: supercarros, muscle, conversíveis, civis, ônibus e vagas fixas.
 * - `TacticalAndFactionFleetBuilder.js`: BOPE, Caveirão V-Hull, Tanque, facções, motos e dispatcher.
 */

import {
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  VEHICLE_SPECS,
  TACTICAL_AND_FACTION_TYPES
} from './vehicles/VehicleSpecsCatalog.js';

import {
  getFinishMaterialOpts,
  makeTaperedHullGeo,
  makeRakedCabinGeo,
  cloneVehicleProto,
  createVehicleMaterialContext,
  computeHardSurfaceChassisDims,
  buildHardSurfaceChassisBase,
  buildStandardRakedCabin,
  buildVaultBoxCabin,
  attachStandardWheelsAndFinalize,
  addPoliceLightbar,
  attachTurboFlames,
  upgradeTrafficLiteCarIfNeeded
} from './vehicles/VehicleChassisPrimitives.js';

import {
  DESIGN_PARKED_CARS_LAYOUT,
  PARKED_CARS_LAYOUT,
  resolveParkedCarsLayout,
  buildUrbanBusMesh,
  buildOpenTopCabin,
  applyCivilianAndSportsDetails,
  buildCivilianOrSportsCarMesh,
  buildParkedLegoCars
} from './vehicles/CivilianAndSportsCarsBuilder.js';

import {
  buildMotorcycleMesh,
  buildTitanTankMesh,
  buildTacticalCabin,
  applyTacticalAndFactionDetails,
  buildTacticalOrFactionVehicleMesh,
  createLegoCarMesh
} from './vehicles/TacticalAndFactionFleetBuilder.js';

export {
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  VEHICLE_SPECS,
  TACTICAL_AND_FACTION_TYPES,
  DESIGN_PARKED_CARS_LAYOUT,
  PARKED_CARS_LAYOUT,
  resolveParkedCarsLayout,
  getFinishMaterialOpts,
  makeTaperedHullGeo,
  makeRakedCabinGeo,
  cloneVehicleProto,
  createVehicleMaterialContext,
  computeHardSurfaceChassisDims,
  buildHardSurfaceChassisBase,
  buildStandardRakedCabin,
  buildVaultBoxCabin,
  attachStandardWheelsAndFinalize,
  addPoliceLightbar,
  attachTurboFlames,
  upgradeTrafficLiteCarIfNeeded,
  buildUrbanBusMesh,
  buildOpenTopCabin,
  applyCivilianAndSportsDetails,
  buildCivilianOrSportsCarMesh,
  buildMotorcycleMesh,
  buildTitanTankMesh,
  buildTacticalCabin,
  applyTacticalAndFactionDetails,
  buildTacticalOrFactionVehicleMesh,
  createLegoCarMesh,
  buildParkedLegoCars
};
