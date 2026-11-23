import * as THREE from 'three';
import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import {
  mergeBufferGeometries,
  mergeColoredGeometries,
  optimizeStaticGroupMeshes,
  getSharedVertexColorMaterial,
  markAsSharedAsset
} from '../../BuildingGenerator.js';
import { NAVAL_AIR_SPECS } from '../../NavalAndAirFleetBuilder.js';
import { addSingleDetailedContainerGeometry } from './EastPortBatcherAndMaterials.js';

function _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, localX, localZ, localW, localD, maxY, minY) {
  const isRot90 = Math.abs(Math.sin(rotY)) > 0.7;
  const wx = isRot90 ? shipX + localZ : shipX + localX;
  const wz = isRot90 ? shipZ - localX : shipZ + localZ;
  const ww = isRot90 ? localD : localW;
  const wd = isRot90 ? localW : localD;
  const col = world.addCollider(wx, wz, ww, wd, maxY, minY);
  col.localX = localX;
  col.localZ = localZ;
  col.localW = localW;
  col.localD = localD;
  col.localMinY = minY;
  col.localMaxY = maxY;
  shipColliders.push(col);
  return col;
}

/**
 * Constrói 1 Grande Navio Porta-Contêineres LEGO 100% Pilotável Atracado no Cais Leste (X = 1668, Z = 240 e Z = 535):
 * - Casco vermelho e preto (250m x 46m), ponte de comando branca de 4 andares na popa,
 *   convés carregado de contêineres 18x6x6 e 2 Rampas Metálicas de Acesso caminháveis!
 */
export function buildMooredLegoCargoShip(world, batcher, shipX, shipZ, colorKeys, gangwayZList, shipLabel) {
  const hullW = 46;
  const hullL = 220;
  const deckY = 9.2;

  const shipBatcher = batcher.createSubBatcher();
  const shipGroup = new THREE.Group();
  shipGroup.rotation.order = 'YXZ';
  const shipColliders = [];

  shipBatcher.addBox('matte_black', hullW, 3.65, hullL, 0, 1.38, 0);
  shipBatcher.addBox('lego_red', hullW + 0.8, 6.0, hullL + 2.0, 0, 6.2, 0);
  shipBatcher.addBox('matte_black', 32, 3.65, 22, 0, 1.38, hullL * 0.5 + 10);
  shipBatcher.addBox('lego_red', 34, 6.0, 20, 0, 6.2, hullL * 0.5 + 9);
  shipBatcher.addBox('tactical_white', hullW + 1.4, 0.75, hullL + 4.0, 0, deckY - 0.35, 0);

  shipBatcher.addBox('armor_slate', hullW, 0.5, hullL + 24, 0, deckY, 10);
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, 0, 0, 10, hullW, hullL + 24, deckY + 0.25, 0);

  // Ponte de Comando Branca de 4 Andares na Popa (localZ = -82)
  const bridgeLocalZ = -82;
  const floorH = 5.0;
  for (let f = 0; f < 4; f++) {
    const fw = 38 - f * 2.5;
    const fd = 26 - f * 2.0;
    const fy = deckY + f * floorH + floorH * 0.5;
    shipBatcher.addBox('tactical_white', fw, floorH, fd, 0, fy, bridgeLocalZ);
    shipBatcher.addBox('dark_steel', fw + 0.5, 1.8, fd - 3.0, 0, fy + 0.5, bridgeLocalZ);
    shipBatcher.addBox('pcc_navy', fw + 0.8, 0.55, fd + 0.8, 0, fy + floorH * 0.5 - 0.25, bridgeLocalZ);
  }
  const bridgeTopY = deckY + 4 * floorH;
  shipBatcher.addCylinder('lego_orange', 3.2, 3.8, 11.0, 0, bridgeTopY + 5.2, bridgeLocalZ - 6, 10);
  shipBatcher.addBox('smoke_plume', 7.5, 4.5, 7.5, 0, bridgeTopY + 13.5, bridgeLocalZ - 6);
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, 0, 0, bridgeLocalZ, 38, 26, bridgeTopY, deckY);

  // Convés carregado de Contêineres LEGO 18x6x6
  for (const bzOff of [-36, -12, 16, 44, 72]) {
    for (const bxOff of [-11, 0, 11]) {
      const layers = 1 + ((Math.abs(bzOff) + Math.abs(bxOff)) % 3);
      for (let s = 0; s < layers; s++) {
        const cKey = colorKeys[(s + (bxOff > 0 ? 2 : 0) + (bzOff > 0 ? 1 : 3)) % colorKeys.length];
        addSingleDetailedContainerGeometry(
          shipBatcher,
          cKey,
          bxOff,
          deckY + 0.25 + s * 6.0 + 3.0,
          bzOff,
          6.0,
          6.0,
          18.0,
          false
        );
        world.eastPortData.detailedContainersCount++;
      }
      _addShipLocalCollider(world, shipColliders, shipX, shipZ, 0, bxOff, bzOff, 6.0, 18.0, deckY + 0.25 + layers * 6.0, deckY);
    }
  }

  shipBatcher.finalize(shipGroup);
  shipGroup.position.set(shipX, 0, shipZ);
  shipGroup.rotation.y = 0;
  shipGroup.userData.isOptimizedGroup = true;
  shipGroup.userData.carType = 'navio_cargueiro';
  shipGroup.userData.carName = `${shipLabel} (PORTA-CONTÊINERES)`;
  shipGroup.userData.vehicleSpec = NAVAL_AIR_SPECS.navio_cargueiro;
  world.scene.add(shipGroup);

  if (!world.cargoShips) world.cargoShips = [];
  world.cargoShips.push({ mesh: shipGroup, halfW: 26, halfL: 126 });

  if (!world._pendingPortVehicles) world._pendingPortVehicles = [];
  world._pendingPortVehicles.push({
    mesh: shipGroup,
    type: 'car',
    hp: NAVAL_AIR_SPECS.navio_cargueiro.hp,
    radius: 28,
    height: bridgeTopY,
    colliders: shipColliders,
    debrisColors: [0xdc2626, 0x090a0d, 0xf8fafc, 0xfacc15],
    studDrops: NAVAL_AIR_SPECS.navio_cargueiro.studDrops,
    groundY: 0
  });

  // 2 Rampas Metálicas de Acesso Caminháveis (Gangways) ligando o Cais Leste ao Convés!
  const gangwayCenterX = IS_SCALED_WORLD ? ws(1620) + 12.0 : 1632.0;
  const gangwayStartX = IS_SCALED_WORLD ? ws(1620) - 3.0 : 1617.0;
  for (const gz of gangwayZList) {
    batcher.addBox('brushed_silver', 30.0, 0.7, 7.6, gangwayCenterX, 4.8, gz, 0, 0, 0.31);
    batcher.addBox('forklift_yellow', 30.0, 1.4, 0.35, gangwayCenterX, 5.6, gz - 3.6, 0, 0, 0.31);
    batcher.addBox('forklift_yellow', 30.0, 1.4, 0.35, gangwayCenterX, 5.6, gz + 3.6, 0, 0, 0.31);
    const steps = 14;
    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      const gCol = world.addCollider(gangwayStartX + t * 29.0, gz, 3.2, 7.6, 0.35 + t * (deckY - 0.35), 0);
      gCol.isGangway = true;
    }
  }

  world.mapBuildings.push({
    x: shipX,
    z: shipZ,
    w: hullW,
    d: hullL,
    height: bridgeTopY,
    color: '#dc2626',
    label: shipLabel
  });
}

/**
 * Constrói o Navio de Guerra / Cargueiro Blindado Preto e Roxo-Neon da Facção `A.R.E.S.` (100% Pilotável)
 * atracado na Doca Sul/Sudeste (X = 1125, Z = 768 — 230m x 44m), com superestrutura cyber de 4 andares,
 * canhões laser navais, contêineres blindados roxo-neon no convés e 2 Rampas de Acesso caminháveis!
 */
export function buildMooredAresDreadnoughtShip(world, batcher, shipX, shipZ) {
  const hullL = 220;
  const hullW = 44;
  const deckY = 9.2;

  const shipBatcher = batcher.createSubBatcher();
  const shipGroup = new THREE.Group();
  shipGroup.rotation.order = 'YXZ';
  const shipColliders = [];
  const rotY = Math.PI / 2;

  // Casco Furtivo Angular orientado com proa em +Z local (que rotacionado em +90 graus aponta para Leste +X!)
  shipBatcher.addBox('matte_black', hullW, 3.8, hullL, 0, 1.45, 0);
  shipBatcher.addBox('gunmetal_concrete', hullW + 1.0, 5.8, hullL + 4, 0, 6.2, 0);
  shipBatcher.addBox('ares_neon_purple', hullW + 1.6, 0.65, hullL + 6, 0, 4.6, 0);
  shipBatcher.addBox('ares_magenta', hullW + 1.6, 0.65, hullL + 6, 0, 8.6, 0);
  shipBatcher.addBox('armor_slate', hullW, 0.5, hullL + 16, 0, deckY, 0);
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, 0, 0, hullW, hullL + 16, deckY + 0.25, 0);

  // Superestrutura de Comando Cyber de 4 Andares na Popa (localZ = -68 -> worldX = shipX - 68)
  const bridgeLocalZ = -68;
  for (let f = 0; f < 4; f++) {
    const fy = deckY + f * 5.2 + 2.6;
    shipBatcher.addBox('matte_black', 34 - f * 2.5, 5.2, 28 - f * 2, 0, fy, bridgeLocalZ);
    shipBatcher.addBox('ares_neon_purple', 35 - f * 2.5, 0.55, 29 - f * 2, 0, fy + 2.2, bridgeLocalZ);
    shipBatcher.addBox('dark_steel', 30 - f * 2.5, 1.8, 28.5 - f * 2, 0, fy + 0.4, bridgeLocalZ);
  }
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, 0, bridgeLocalZ, 34, 28, deckY + 21.0, deckY);

  // Canhão Naval Duplo de Plasma na Proa (localZ = +82 -> worldX = shipX + 82) + Pilhas de Contêineres Blindados A.R.E.S.
  shipBatcher.addCylinder('gunmetal_concrete', 6.5, 7.8, 4.5, 0, deckY + 2.5, 82, 10);
  shipBatcher.addBox('ares_magenta', 1.1, 1.1, 12.0, -2.2, deckY + 3.4, 90);
  shipBatcher.addBox('ares_magenta', 1.1, 1.1, 12.0, 2.2, deckY + 3.4, 90);

  for (const bzOff of [-22, 6, 34, 58]) {
    for (const bxOff of [-10, 10]) {
      addSingleDetailedContainerGeometry(shipBatcher, 'matte_black', bxOff, deckY + 3.25, bzOff, 6.0, 6.0, 18.0, false);
      shipBatcher.addBox('ares_neon_purple', 6.3, 0.45, 18.2, bxOff, deckY + 5.8, bzOff);
      world.eastPortData.detailedContainersCount++;
      _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, bxOff, bzOff, 6.0, 18.0, deckY + 6.25, deckY);
    }
  }

  shipBatcher.finalize(shipGroup);
  shipGroup.position.set(shipX, 0, shipZ);
  shipGroup.rotation.y = rotY;
  shipGroup.userData.isOptimizedGroup = true;
  shipGroup.userData.carType = 'navio_ares';
  shipGroup.userData.carName = NAVAL_AIR_SPECS.navio_ares.name;
  shipGroup.userData.vehicleSpec = NAVAL_AIR_SPECS.navio_ares;
  world.scene.add(shipGroup);

  if (!world.cargoShips) world.cargoShips = [];
  world.cargoShips.push({ mesh: shipGroup, halfW: 25, halfL: 120 });

  if (!world._pendingPortVehicles) world._pendingPortVehicles = [];
  world._pendingPortVehicles.push({
    mesh: shipGroup,
    type: 'car',
    hp: NAVAL_AIR_SPECS.navio_ares.hp,
    radius: 28,
    height: deckY + 21,
    colliders: shipColliders,
    debrisColors: [0x090a0d, 0x334155, 0xa855f7, 0xd946ef],
    studDrops: NAVAL_AIR_SPECS.navio_ares.studDrops,
    groundY: 0
  });

  // Em 3x, estende o Píer/Deck Naval Blindado da A.R.E.S. do Cais Sul (ws(734)) até a borda de águas profundas (shipZ - 34)
  if (IS_SCALED_WORLD) {
    const jettyZStart = ws(734);
    const jettyZEnd = shipZ - 34.0;
    const jettyD = Math.max(12.0, jettyZEnd - jettyZStart);
    const jettyCZ = (jettyZStart + jettyZEnd) * 0.5;
    batcher.addBox('gunmetal_concrete', 136.0, 1.5, jettyD, shipX, -0.4, jettyCZ);
    batcher.addBox('matte_black', 132.0, 0.16, jettyD - 2.0, shipX, 0.28, jettyCZ);
    batcher.addBox('ares_neon_purple', 135.0, 0.14, 0.65, shipX, 0.34, jettyZEnd - 1.2);
    world.addCollider(shipX, jettyCZ, 136.0, jettyD, 0.35, -1.2);
  }

  // 2 Rampas Metálicas de Acesso Caminháveis ligando o Cais/Píer Sul ao Convés (Y = 9.2m)!
  const gangwayCenterZ = IS_SCALED_WORLD ? shipZ - 27.0 : 741.0;
  const gangwayStartZ = IS_SCALED_WORLD ? shipZ - 35.0 : 733.0;
  for (const gx of [shipX - 50, shipX + 50]) {
    batcher.addBox('brushed_silver', 7.6, 0.7, 22.0, gx, 4.8, gangwayCenterZ, -0.38, 0, 0);
    batcher.addBox('ares_neon_purple', 0.4, 1.4, 22.0, gx - 3.6, 5.6, gangwayCenterZ, -0.38, 0, 0);
    batcher.addBox('ares_neon_purple', 0.4, 1.4, 22.0, gx + 3.6, 5.6, gangwayCenterZ, -0.38, 0, 0);
    const steps = 12;
    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      const gCol = world.addCollider(gx, gangwayStartZ + t * 16.0, 7.6, 3.0, 0.35 + t * (deckY - 0.35), 0);
      gCol.isGangway = true;
    }
  }

  world.mapBuildings.push({
    x: shipX,
    z: shipZ,
    w: hullL,
    d: hullW,
    height: deckY + 21,
    color: '#9333ea',
    label: 'NAVIO BLINDADO A.R.E.S.'
  });
}

const _TRUCK_TIRE_GEO = new THREE.CylinderGeometry(0.68, 0.68, 0.56, 10);
_TRUCK_TIRE_GEO.rotateZ(Math.PI / 2);
const _TRUCK_RIM_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 8);
_TRUCK_RIM_GEO.rotateZ(Math.PI / 2);
const SHARED_TRUCK_WHEEL_GEO = markAsSharedAsset(
  mergeColoredGeometries([
    { geo: _TRUCK_TIRE_GEO, color: new THREE.Color(0x0f172a) },
    { geo: _TRUCK_RIM_GEO, color: new THREE.Color(0xcbd5e1) }
  ])
);
const SHARED_TRUCK_WHEEL_MAT = getSharedVertexColorMaterial({
  roughness: 0.32,
  metalness: 0.35,
  clearcoat: 0.28,
  clearcoatRoughness: 0.25
});
const _TRUCK_FLAME_L = new THREE.ConeGeometry(0.36, 2.2, 8);
_TRUCK_FLAME_L.rotateX(-Math.PI / 2);
_TRUCK_FLAME_L.translate(-1.4, 1.05, -12.3);
const _TRUCK_FLAME_R = new THREE.ConeGeometry(0.36, 2.2, 8);
_TRUCK_FLAME_R.rotateX(-Math.PI / 2);
_TRUCK_FLAME_R.translate(1.4, 1.05, -12.3);
const SHARED_TRUCK_FLAME_GEO = markAsSharedAsset(mergeBufferGeometries([_TRUCK_FLAME_L, _TRUCK_FLAME_R]));
const SHARED_TRUCK_FLAME_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
const _PORT_SEMI_TRUCK_PARTS_CACHE = new Map();

/**
 * Constrói 1 Caminhão-Carreta Portuário 100% Pilotável (Semi-Truck com Contêiner 18x6x6 na carreta, rodas articuladas e Turbo Nitro)
 */
export function addPortCargoSemiTruck(world, batcher, x, z, containerColorKey, rotated90 = false) {
  world.eastPortData.cargoTrucksCount++;

  const truckGroup = new THREE.Group();
  truckGroup.rotation.order = 'YXZ';

  const cabColorKey = rotated90 ? 'tactical_white' : 'lego_orange';
  const bodyCacheKey = `${cabColorKey}|${containerColorKey}`;
  const axleZList = [
    { wz: 8.6, isFront: true },
    { wz: 4.4, isFront: false },
    { wz: -5.5, isFront: false },
    { wz: -8.8, isFront: false }
  ];
  let cachedParts = _PORT_SEMI_TRUCK_PARTS_CACHE.get(bodyCacheKey);

  if (!cachedParts) {
    const truckBatcher = batcher.createSubBatcher();
    truckBatcher.addBox('matte_black', 4.8, 1.2, 22.5, 0, 1.05, 0);
    truckBatcher.addBox('brushed_silver', 4.95, 0.65, 0.45, 0, 0.9, 11.2);
    truckBatcher.addBox('brushed_silver', 3.4, 1.55, 0.25, 0, 2.05, 10.95);
    truckBatcher.addBox(cabColorKey, 4.6, 4.2, 4.6, 0, 2.85, 8.6);
    truckBatcher.addBox(cabColorKey, 4.4, 1.05, 2.6, 0, 5.25, 7.8, -0.24, 0, 0);
    truckBatcher.addBox('dark_steel', 4.66, 1.6, 1.6, 0, 3.35, 10.15);
    truckBatcher.addBox('floodlight_glow', 0.85, 0.45, 0.2, -1.75, 1.55, 10.96);
    truckBatcher.addBox('floodlight_glow', 0.85, 0.45, 0.2, 1.75, 1.55, 10.96);
    truckBatcher.addBox('c4_hazard_red', 0.9, 0.42, 0.2, -1.8, 1.05, -11.28);
    truckBatcher.addBox('c4_hazard_red', 0.9, 0.42, 0.2, 1.8, 1.05, -11.28);
    truckBatcher.addCylinder('brushed_silver', 0.22, 0.22, 4.8, -2.35, 3.7, 6.0, 8);
    truckBatcher.addCylinder('brushed_silver', 0.22, 0.22, 4.8, 2.35, 3.7, 6.0, 8);

    addSingleDetailedContainerGeometry(truckBatcher, containerColorKey, 0, 4.65, -2.4, 6.0, 6.0, 18.0, false);

    const tempBodyGroup = new THREE.Group();
    truckBatcher.finalize(tempBodyGroup);
    optimizeStaticGroupMeshes(tempBodyGroup);
    const bodyParts = tempBodyGroup.children.map((ch) => {
      markAsSharedAsset(ch.geometry);
      markAsSharedAsset(ch.material);
      return {
        geometry: ch.geometry,
        material: ch.material,
        castShadow: ch.castShadow,
        receiveShadow: ch.receiveShadow
      };
    });

    const tempLiteGroup = new THREE.Group();
    for (let i = 0; i < bodyParts.length; i++) {
      const bp = bodyParts[i];
      const bm = new THREE.Mesh(bp.geometry.clone(), bp.material);
      bm.castShadow = bp.castShadow;
      bm.receiveShadow = bp.receiveShadow;
      tempLiteGroup.add(bm);
    }
    for (const { wz } of axleZList) {
      for (const wx of [-2.35, 2.35]) {
        const wm = new THREE.Mesh(SHARED_TRUCK_WHEEL_GEO.clone(), SHARED_TRUCK_WHEEL_MAT);
        wm.position.set(wx, 0.68, wz);
        tempLiteGroup.add(wm);
      }
    }
    optimizeStaticGroupMeshes(tempLiteGroup);
    const liteParts = tempLiteGroup.children.map((ch) => {
      markAsSharedAsset(ch.geometry);
      markAsSharedAsset(ch.material);
      return {
        geometry: ch.geometry,
        material: ch.material,
        castShadow: ch.castShadow,
        receiveShadow: ch.receiveShadow
      };
    });

    cachedParts = { bodyParts, liteParts };
    _PORT_SEMI_TRUCK_PARTS_CACHE.set(bodyCacheKey, cachedParts);
  }

  const liteMeshes = [];
  for (let i = 0; i < cachedParts.liteParts.length; i++) {
    const p = cachedParts.liteParts[i];
    const m = new THREE.Mesh(p.geometry, p.material);
    m.castShadow = p.castShadow;
    m.receiveShadow = p.receiveShadow;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    truckGroup.add(m);
    liteMeshes.push(m);
  }

  truckGroup.userData._trafficLite = true;
  truckGroup.userData._customTrafficLiteUpgrade = (grp) => {
    for (let i = 0; i < liteMeshes.length; i++) grp.remove(liteMeshes[i]);
    for (let i = 0; i < cachedParts.bodyParts.length; i++) {
      const p = cachedParts.bodyParts[i];
      const m = new THREE.Mesh(p.geometry, p.material);
      m.castShadow = p.castShadow;
      m.receiveShadow = p.receiveShadow;
      grp.add(m);
    }
    const dynWheels = [];
    for (const { wz, isFront } of axleZList) {
      for (const wx of [-2.35, 2.35]) {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(wx, 0.68, wz);
        const spinGroup = new THREE.Group();
        spinGroup.add(new THREE.Mesh(SHARED_TRUCK_WHEEL_GEO, SHARED_TRUCK_WHEEL_MAT));
        steerGroup.add(spinGroup);
        grp.add(steerGroup);
        dynWheels.push({ steerGroup, spinGroup, isFront });
      }
    }
    const flameGroup = new THREE.Group();
    flameGroup.visible = false;
    flameGroup.add(new THREE.Mesh(SHARED_TRUCK_FLAME_GEO, SHARED_TRUCK_FLAME_MAT));
    grp.add(flameGroup);
    grp.userData.wheels = dynWheels;
    grp.userData.turboFlames = [flameGroup];
  };

  const rotY = rotated90 ? Math.PI / 2 : 0;
  const truckTY = world.getTerrainHeightAt && x > ws(622) && x < ws(1430) && z > ws(-720) && z < ws(-40)
    ? Math.max(0, world.getTerrainHeightAt(x, z))
    : 0;
  truckGroup.position.set(x, truckTY, z);
  truckGroup.rotation.y = rotY;
  truckGroup.userData.isOptimizedGroup = true;
  truckGroup.userData.carType = 'caminhao_carreta';
  truckGroup.userData.carName = NAVAL_AIR_SPECS.caminhao_carreta.name;
  truckGroup.userData.vehicleSpec = NAVAL_AIR_SPECS.caminhao_carreta;
  truckGroup.userData.wheels = [];
  truckGroup.userData.turboFlames = [];
  world.scene.add(truckGroup);

  const colW = rotated90 ? 23.0 : 5.2;
  const colD = rotated90 ? 5.2 : 23.0;
  const col = world.addCollider(x, z, colW, colD, 7.6, 0.28);

  if (!world._pendingPortVehicles) world._pendingPortVehicles = [];
  world._pendingPortVehicles.push({
    mesh: truckGroup,
    type: 'car',
    hp: NAVAL_AIR_SPECS.caminhao_carreta.hp,
    radius: 11.5,
    height: 7.6,
    colliders: [col],
    debrisColors: [0xf97316, 0x090a0d, 0xf8fafc, 0xfacc15],
    studDrops: NAVAL_AIR_SPECS.caminhao_carreta.studDrops,
    groundY: truckTY
  });
}
