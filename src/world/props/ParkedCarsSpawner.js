/**
 * ParkedCarsSpawner.js
 * Submódulo de frota estacionada e especificações veiculares da malha urbana.
 * Centraliza o contrato de vagas de rua, estacionamentos e malha 3D de veículos
 * consumido pela fachada `StreetPropsBuilder.js` e por `TestBlockWorld`.
 */

import {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  buildParkedLegoCars as spawnFleetParkedLegoCars,
  createLegoCarMesh
} from '../VehicleFleetBuilder.js';

export {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  createLegoCarMesh
};

export function buildParkedLegoCars(world) {
  return spawnFleetParkedLegoCars(world);
}
