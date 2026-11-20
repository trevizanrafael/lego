/**
 * StreetPropsBuilder.js
 * Fachada orquestradora de mobiliário urbano quebrável, frota estacionada e objetos especiais.
 *
 * Arquitetura modular (`src/world/props/`):
 * - `ParkedCarsSpawner.js`: frota estacionada, vagas urbanas/estacionamentos e malha de veículos (`createLegoCarMesh`).
 * - `StreetPropTemplates.js`: catálogo compartilhado de geometrias/materiais pré-mesclados (~450 props a 60 FPS).
 * - `BreakableStreetPropsSpawner.js`: ~450 props quebráveis consolidados em ~24 `InstancedMesh` Draw Calls
 *   (postes, semáforos, hidrantes, pontos de ônibus, cabines, bancas, ATMs, carrinhos, mesas, lixeiras,
 *   caçambas, bancos, placas, cones, barricadas e caixas).
 * - `NewsstandsFencesAndGoldBuilder.js`: cercas brancas quebráveis de praças/subúrbio e objetos especiais
 *   de poder (Cofres Dourados para Raio Solar, Paredes Rachadas para Titã Blindado e Cofres Prateados para RPG).
 */

import {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  buildParkedLegoCars,
  createLegoCarMesh
} from './props/ParkedCarsSpawner.js';
import { buildStreetProps as spawnBreakableStreetProps } from './props/BreakableStreetPropsSpawner.js';
import {
  buildNewsstandsAndFences as spawnNewsstandsAndFences,
  buildGoldenLegoObjects as spawnGoldenLegoObjects
} from './props/NewsstandsFencesAndGoldBuilder.js';

export {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  buildParkedLegoCars,
  createLegoCarMesh
};

/**
 * Catálogo descritivo das camadas de mobiliário urbano gerenciadas pela fachada.
 * Útil para inspeção/diagnóstico sem acoplamento com os pools internos de `InstancedMesh`.
 */
export const STREET_PROPS_LAYER_SUMMARY = Object.freeze({
  breakableInstancedProps: Object.freeze([
    'streetlamp',
    'traffic_light',
    'hydrant',
    'bus_stop',
    'phone_booth',
    'newsstand',
    'atm_machine',
    'food_cart',
    'cafe_table',
    'trash_can',
    'dumpster',
    'park_bench',
    'street_sign',
    'traffic_cone',
    'orange_barricade',
    'crate'
  ]),
  specialPowerTargets: Object.freeze(['gold_vault', 'cracked_wall', 'silver_lego'])
});

/**
 * Constrói e consolida ~450 objetos quebráveis de calçada/acostamento em lotes `InstancedMesh`
 * (~24 Draw Calls totais), conectando proxies leves ao `DestructibleManager`.
 *
 * @param {import('./TestBlockWorld.js').TestBlockWorld} world
 */
export function buildStreetProps(world) {
  if (!world || !world.scene) return;
  spawnBreakableStreetProps(world);
}

/**
 * Constrói cercas brancas quebráveis nas praças centrais e nos jardins do Subúrbio Norte.
 *
 * @param {import('./TestBlockWorld.js').TestBlockWorld} world
 */
export function buildNewsstandsAndFences(world) {
  if (!world || !world.scene) return;
  spawnNewsstandsAndFences(world);
}

/**
 * Constrói os marcos especiais destrutíveis por poderes específicos de heróis:
 * - Cofres Dourados (`gold_vault` — Raio Solar Contínuo de Solaris)
 * - Paredes Rachadas (`cracked_wall` — Soco Foguete / Terremoto do Titã Blindado)
 * - Objetos Prateados (`silver_lego` — Bazuca RPG do Vingador de Chumbo)
 *
 * @param {import('./TestBlockWorld.js').TestBlockWorld} world
 */
export function buildGoldenLegoObjects(world) {
  if (!world || !world.scene) return;
  spawnGoldenLegoObjects(world);
}

/**
 * Utilitário orquestrador para popular toda a camada de objetos quebráveis de rua de uma só vez.
 *
 * @param {import('./TestBlockWorld.js').TestBlockWorld} world
 */
export function buildAllCityStreetProps(world) {
  if (!world || !world.scene) return;
  buildStreetProps(world);
  buildNewsstandsAndFences(world);
  buildGoldenLegoObjects(world);
}
