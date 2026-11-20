import * as THREE from 'three';
import {
  buildCarrierHullAndBelly,
  buildCarrierFourTurbines
} from './helicarrier/CarrierHullAndTurbines.js';
import {
  initHelicarrierNightFXAndMaterials,
  buildCarrierFlightDeckElevatorsAndCatapults,
  buildCarrierCommandIsland,
  buildCarrierCustomizationHangar,
  buildCarrierInstancedDeckProps,
  buildLegoClouds
} from './helicarrier/CarrierDeckIslandAndClouds.js';

export { buildLegoClouds };

/**
 * 10. NO CÉU (ALTITUDE Y = 410m, FACHADA FINA): AEROPORTA-AVIÕES MONUMENTAL (S.H.I.E.L.D. HELICARRIER)
 * - Casco multicamadas com proa afilada, recortes mecânicos laterais, quilha dupla e reator repulsor
 * - Convés detalhado: pista axial 09/27, pista em ângulo bombordo, 2 catapultas, cabos de parada, 2 elevadores e heliponto
 * - Torre de comando multinível com ponte inclinada iluminada, radares giratórios e mastro de comunicações
 * - 4 Mega-Turbinas Rotoras com carenagem dupla e anel de plasma
 * - Hangar / Oficina de Personalização de Aeronaves no convés + Props instanciados em LOD de 3 níveis
 */
export function buildSkyHelicarrier(world) {
  const cfg = {
    hx: 0,
    hy: 410.0,
    hz: -50,
    deckW: 104,
    deckD: 260,
    hullThickness: 26.0
  };

  const carrierGroup = new THREE.Group();
  carrierGroup.position.set(cfg.hx, cfg.hy, cfg.hz);
  carrierGroup.userData = { isHelicarrier: true, altitude: cfg.hy, hullThickness: cfg.hullThickness };
  world.scene.add(carrierGroup);
  world.helicarrierGroup = carrierGroup;

  // Inicializa `world.helicarrierNightFX` e os materiais navais compartilhados
  const { nightFx, mats } = initHelicarrierNightFXAndMaterials(world);

  // LOD de 3 níveis do Porta-Aviões + grupo estrutural principal
  const carrierLOD = new THREE.LOD();
  carrierGroup.add(carrierLOD);
  world.helicarrierLOD = carrierLOD;

  const lod0 = new THREE.Group();
  const lod1 = new THREE.Group();
  const lod2 = new THREE.Group();
  carrierLOD.addLevel(lod0, 0);
  carrierLOD.addLevel(lod1, 460);
  carrierLOD.addLevel(lod2, 1150);

  const hullStructureGroup = new THREE.Group();
  carrierGroup.add(hullStructureGroup);

  const ctx = { cfg, hullStructureGroup, lod0, lod1, lod2, mats, nightFx };

  // 1. Casco facetado espesso em Y=410m + iluminação inferior
  buildCarrierHullAndBelly(world, ctx);

  // 2. Convés de voo, 2 catapultas, 2 elevadores e heliponto
  buildCarrierFlightDeckElevatorsAndCatapults(ctx);

  // 3. Torre de comando multinível (Ilha) e radares giratórios
  buildCarrierCommandIsland(world, ctx);

  // 4. 4 Mega-turbinas com rotores giratórios
  buildCarrierFourTurbines(world, ctx);

  // 5. Hangar / Oficina de Personalização de Aeronaves + Consoles
  buildCarrierCustomizationHangar(world, ctx);

  // 6. Props instanciados em LOD 0/1, luzes de navegação e caixas quebráveis
  buildCarrierInstancedDeckProps(world, ctx);
}
