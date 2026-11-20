import * as THREE from 'three';
import {
  CLASSIC_LEGO_CONTAINER_KEYS,
  addCorrugatedContainerStack,
  addSingleDetailedContainerGeometry
} from './EastPortBatcherAndMaterials.js';
import {
  buildPortLogisticsRoadNetworkAndQuay,
  buildEightPortWarehousesFuelTerminalAndHarborTower
} from './PortLogisticsAndWarehousesBuilder.js';
import {
  buildMassiveContainerYardBlocksAndRTGCranes,
  buildColossalPortainerCrane
} from './PortCranesAndContainersBuilder.js';
import {
  buildMooredLegoCargoShip,
  buildMooredAresDreadnoughtShip,
  addPortCargoSemiTruck
} from './CargoShipsAndDocksBuilder.js';

/**
 * 6. PORTO DE CARGAS, BASE A.R.E.S. & CAIS MARÍTIMO (NO EXTREMO LESTE/SUDESTE: X = 600..1620, Z = 115..735)
 */
export function buildMetropolitanPortAndDocks(world, batcher) {
  world.eastPortData = {
    hasHeavyConcreteQuay: true,
    logisticsAvenuesCount: 9,
    truckRoundaboutsCount: 4,
    demarcatedCargoYardsCount: 10,
    dockGatehousesCount: 6,
    zebraStripesSegments: 0,
    bollardsCount: 0,
    rubberFendersCount: 0,
    floodlightTowersCount: 0,
    floodlightTowerHeight: 48,
    containerDimensions: { length: 18, width: 6, height: 6 },
    yardBlocksCount: 40,
    rtgCranesCount: 18,
    rtgCraneHeight: 56,
    detailedContainersCount: 0,
    fourStoryStacksCount: 0,
    fiveStoryStacksCount: 0,
    sixToEightStoryStacksCount: 0,
    containerSkybridgesCount: 0,
    rooftopCatwalksCount: 0,
    openAresContainersCount: 0,
    numberedWarehouses: [
      'DOCA 01',
      'DOCA 02',
      'DOCA 03',
      'DOCA 04',
      'DOCA 05',
      'DOCA 06',
      'DOCA 07',
      'DOCA 08',
      'DOCA 09',
      'DOCA 10'
    ],
    fuelTanksCount: 12,
    petroTowersCount: 2,
    gasSpheresCount: 4,
    hasHarborMasterTower: true,
    harborMasterTowerHeight: 92,
    hasAresPortBase: true,
    aresHangarHeight: 52,
    aresCyberTowerHeight: 88,
    aresLaserTurretsCount: 4,
    aresPlasmaGeneratorsCount: 6,
    portainerCranesCount: 5,
    portainerHeight: 76,
    craneDriveThroughClearanceWidth: 42,
    hasMooredCargoShip: true,
    mooredCargoShipsCount: 3,
    hasAresWarship: true,
    cargoShipLength: 250,
    cargoShipBridgeFloors: 4,
    shipGangwaysCount: 6,
    cargoTrucksCount: 0
  };

  const classicLegoContainerKeys = CLASSIC_LEGO_CONTAINER_KEYS;

  // 1. Vias portuárias asfaltadas, rotatórias de caminhões, setores demarcados, cercas & cais pesado
  buildPortLogisticsRoadNetworkAndQuay(world, batcher);

  // 2. Os 10 grandes armazéns (`DOCA 01`..`DOCA 10`), terminal de combustível & Torre da Capitania (92m)
  buildEightPortWarehousesFuelTerminalAndHarborTower(world, batcher, classicLegoContainerKeys);

  // 3. Selva de contêineres 18x6x6 em 40 blocos maciços + 18 pórticos RTG
  buildMassiveContainerYardBlocksAndRTGCranes(world, batcher, classicLegoContainerKeys);

  // 4. Base portuária fortificada da 3ª facção: `A.R.E.S.` (Cyber-Mercenários Tecnológicos)
  buildAresCyberMercenaryPortBase(world, batcher);

  // 5. Os 5 Guindastes Portuários Gigantes (76m: 3 Leste + 2 Sul) & 3 Grandes Navios Atracados
  const eastCraneZCoords = [215, 415, 605];
  eastCraneZCoords.forEach((gz, idx) => {
    buildColossalPortainerCrane(world, batcher, 1555, gz, classicLegoContainerKeys[idx % classicLegoContainerKeys.length], false);
  });
  const southCraneXCoords = [1045, 1215];
  southCraneXCoords.forEach((gx, idx) => {
    buildColossalPortainerCrane(world, batcher, gx, 695, idx === 0 ? 'ares_neon_purple' : 'lego_orange', true);
  });

  buildMooredLegoCargoShip(world, batcher, 1668, 240, classicLegoContainerKeys, [185, 295], 'NAVIO PORTA-CONTÊINERES 01');
  buildMooredLegoCargoShip(world, batcher, 1668, 535, classicLegoContainerKeys, [362, 502], 'NAVIO PORTA-CONTÊINERES 02');
  buildMooredAresDreadnoughtShip(world, batcher, 1125, 768);

  // Caminhões-Carreta extras nas Avenidas Principais do Porto
  addPortCargoSemiTruck(world, batcher, 814, 362, 'lego_red', false);
  addPortCargoSemiTruck(world, batcher, 1545, 250, 'pcc_royal', false);
}

/**
 * Constrói 1 Contêiner Blindado Aberto da A.R.E.S. (18m x 6m x 6m) com frisos roxo-neon, cargas de armas laser e Studs dentro!
 */
function _addOpenAresContrabandContainer(world, batcher, x, z) {
  world.eastPortData.openAresContainersCount++;
  world.eastPortData.detailedContainersCount++;
  const cw = 6.2;
  const ch = 6.0;
  const cd = 18.0;
  const y0 = 0.28;

  batcher.addBox('matte_black', cw, 0.38, cd, x, y0 + 0.19, z);
  batcher.addBox('matte_black', cw, 0.38, cd, x, y0 + ch - 0.19, z);
  batcher.addBox('gunmetal_concrete', 0.38, ch, cd, x - cw * 0.5 + 0.19, y0 + ch * 0.5, z);
  batcher.addBox('gunmetal_concrete', 0.38, ch, cd, x + cw * 0.5 - 0.19, y0 + ch * 0.5, z);
  batcher.addBox('gunmetal_concrete', cw, ch, 0.38, x, y0 + ch * 0.5, z - cd * 0.5 + 0.19);
  batcher.addBox('ares_neon_purple', cw + 0.3, 0.42, cd + 0.2, x, y0 + ch - 0.5, z);

  batcher.addBox('matte_black', 0.34, ch - 0.2, 3.2, x - cw * 0.5 - 0.9, y0 + ch * 0.5, z + cd * 0.5 + 1.2, 0, -0.55, 0);
  batcher.addBox('matte_black', 0.34, ch - 0.2, 3.2, x + cw * 0.5 + 0.9, y0 + ch * 0.5, z + cd * 0.5 + 1.2, 0, 0.55, 0);

  for (const czOff of [-5.2, -1.0, 3.2]) {
    batcher.addBox('matte_black', 3.8, 1.65, 2.8, x, y0 + 1.15, z + czOff);
    batcher.addBox('brushed_silver', 3.9, 0.32, 2.9, x, y0 + 1.85, z + czOff);
    batcher.addBox('ares_magenta', 3.95, 0.42, 2.95, x, y0 + 1.25, z + czOff);
  }

  world.addCollider(x - cw * 0.5 + 0.2, z, 0.5, cd, y0 + ch, y0);
  world.addCollider(x + cw * 0.5 - 0.2, z, 0.5, cd, y0 + ch, y0);
  world.addCollider(x, z - cd * 0.5 + 0.2, cw, 0.5, y0 + ch, y0);

  if (world.destructibles) {
    world.destructibles.spawnAmbientStud(x - 0.9, y0 + 2.2, z + 4.5, 'blue');
    world.destructibles.spawnAmbientStud(x + 0.9, y0 + 2.2, z + 4.5, 'gold');
    world.destructibles.spawnAmbientStud(x, y0 + 2.2, z + 6.2, 'purple');
  }
}

/**
 * 4. BASE PORTUÁRIA FORTIFICADA DA 3ª FACÇÃO: `A.R.E.S.` (CYBER-MERCENÁRIOS TECNOLÓGICOS — X = 855..1135, Z = 555..695)
 */
export function buildAresCyberMercenaryPortBase(world, batcher) {
  const ax = 995;
  const az = 622;
  const hw = 96;
  const hd = 60;
  const hh = 52;
  const towerH = 88;

  batcher.addBox('gunmetal_concrete', hw, hh, hd, ax, 0.28 + hh * 0.5, az);
  batcher.addBox('matte_black', hw + 2.4, 8.5, hd + 2.4, ax, 0.28 + hh - 5.2, az);
  batcher.addBox('armor_slate', hw * 0.78, 6.0, hd - 6, ax, 0.28 + hh + 3.0, az);

  batcher.addBox('matte_black', 54, 18, 42, ax, 52.28 + 9.0, az);
  batcher.addBox('ares_neon_purple', 56, 1.2, 44, ax, 69.5, az);
  batcher.addBox('gunmetal_concrete', 38, 18, 32, ax, 70.28 + 9.0, az);
  batcher.addBox('ares_magenta', 40, 1.2, 34, ax, 87.2, az);

  for (const txOff of [-16, 16]) {
    for (const tzOff of [-13, 13]) {
      batcher.addBox('matte_black', 4.2, towerH, 4.2, ax + txOff, 0.28 + towerH * 0.5, az + tzOff);
      batcher.addBox('ares_neon_purple', 1.6, towerH + 1.0, 4.6, ax + txOff, 0.28 + towerH * 0.5, az + tzOff);
      batcher.addBox('ares_magenta', 4.6, towerH + 1.0, 1.6, ax + txOff, 0.28 + towerH * 0.5, az + tzOff);
    }
  }

  batcher.addCylinder('matte_black', 15.0, 15.0, 0.6, ax, 88.5, az, 16);
  batcher.addCylinder('ares_neon_purple', 15.6, 15.6, 0.35, ax, 88.55, az, 16);
  batcher.addBox('ares_magenta', 2.0, 0.18, 9.5, ax - 3.5, 88.85, az);
  batcher.addBox('ares_magenta', 2.0, 0.18, 9.5, ax + 3.5, 88.85, az);
  batcher.addBox('ares_magenta', 7.0, 0.18, 2.0, ax, 88.85, az);

  const aresRadarGroup = new THREE.Group();
  aresRadarGroup.position.set(ax + 13, 91.8, az - 11);
  const aresRadarBar = new THREE.Mesh(
    new THREE.BoxGeometry(11.0, 1.4, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.9 })
  );
  aresRadarGroup.add(aresRadarBar);
  world.scene.add(aresRadarGroup);
  world.rotatingElements.push({ mesh: aresRadarGroup, axis: 'y', speed: 3.1 });

  for (let fx = ax - 40; fx <= ax + 40; fx += 20) {
    batcher.addBox('matte_black', 5.0, hh + 2, hd + 4.2, fx, 0.28 + hh * 0.5, az);
    batcher.addBox('ares_neon_purple', 1.4, hh - 4, hd + 4.8, fx, 0.28 + hh * 0.5, az);
  }
  for (const bandY of [14, 28, 42, 50]) {
    batcher.addBox('ares_magenta', hw + 3.2, 1.15, hd + 3.2, ax, bandY, az);
  }
  for (const sideZ of [-1, 1]) {
    const gz = az + sideZ * (hd * 0.5 + 0.4);
    batcher.addBox('dark_steel', 42, 24, 1.6, ax, 12.28, gz);
    batcher.addBox('ares_neon_purple', 44, 1.2, 2.0, ax, 24.5, gz);
  }
  world.addCollider(ax, az, hw, hd, 0.28 + towerH, 0.28);
  world.mapBuildings.push({
    x: ax,
    z: az,
    w: hw,
    d: hd,
    height: towerH,
    color: '#9333ea',
    label: 'TORRE & HANGAR CYBER A.R.E.S.'
  });

  // 2) SELVA / FORTALEZA DE CONTÊINERES BLINDADOS PRETOS E ROXO-NEON
  const aresContainerKeys = ['matte_black', 'gunmetal_concrete', 'armor_slate'];
  const aresFortressStacks = [
    { x: 866, z: 582, floors: 7, rotated: false },
    { x: 866, z: 602, floors: 6, rotated: false },
    { x: 866, z: 622, floors: 7, rotated: false },
    { x: 866, z: 642, floors: 6, rotated: false },
    { x: 866, z: 662, floors: 7, rotated: false },
    { x: 896, z: 582, floors: 6, rotated: false },
    { x: 896, z: 622, floors: 7, rotated: false },
    { x: 896, z: 662, floors: 6, rotated: false },
    { x: 926, z: 582, floors: 5, rotated: false },
    { x: 926, z: 622, floors: 6, rotated: false },
    { x: 926, z: 662, floors: 5, rotated: false },
    { x: 884, z: 562, floors: 6, rotated: true },
    { x: 914, z: 562, floors: 5, rotated: true },
    { x: 884, z: 684, floors: 6, rotated: true },
    { x: 914, z: 684, floors: 5, rotated: true },

    { x: 1064, z: 582, floors: 5, rotated: false },
    { x: 1064, z: 622, floors: 6, rotated: false },
    { x: 1064, z: 662, floors: 5, rotated: false },
    { x: 1094, z: 582, floors: 6, rotated: false },
    { x: 1094, z: 622, floors: 7, rotated: false },
    { x: 1094, z: 662, floors: 6, rotated: false },
    { x: 1124, z: 582, floors: 7, rotated: false },
    { x: 1124, z: 602, floors: 6, rotated: false },
    { x: 1124, z: 622, floors: 7, rotated: false },
    { x: 1124, z: 642, floors: 6, rotated: false },
    { x: 1124, z: 662, floors: 7, rotated: false },
    { x: 1076, z: 562, floors: 5, rotated: true },
    { x: 1106, z: 562, floors: 6, rotated: true },
    { x: 1076, z: 684, floors: 5, rotated: true },
    { x: 1106, z: 684, floors: 6, rotated: true }
  ];

  aresFortressStacks.forEach((st, idx) => {
    addCorrugatedContainerStack(world, batcher, st.x, st.z, st.floors, st.rotated, aresContainerKeys, idx);
    const cw = st.rotated ? 18.0 : 6.2;
    const cd = st.rotated ? 6.2 : 18.0;
    const topY = 0.28 + st.floors * 6.0;
    batcher.addBox(idx % 2 === 0 ? 'ares_neon_purple' : 'ares_magenta', cw + 0.25, 0.45, cd + 0.25, st.x, topY - 0.35, st.z);
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
    if (st.floors >= 6) world.eastPortData.sixToEightStoryStacksCount++;
  });

  for (const bridgeZ of [582, 622, 662]) {
    for (const bridgeX of [940, 1050]) {
      batcher.addBox('matte_black', 22.0, 0.7, 4.6, bridgeX, 30.5, bridgeZ);
      batcher.addBox('ares_neon_purple', 22.4, 0.4, 5.0, bridgeX, 30.9, bridgeZ);
      world.addCollider(bridgeX, bridgeZ, 22.0, 4.6, 31.1, 30.2);
      world.eastPortData.rooftopCatwalksCount++;
    }
  }

  const aresOpenCoords = [
    [881, 582], [911, 582], [1079, 582], [1109, 582],
    [881, 622], [911, 622], [1079, 622], [1109, 622],
    [881, 662], [911, 662], [1079, 662], [1109, 662]
  ];
  for (const [ox, oz] of aresOpenCoords) {
    _addOpenAresContrabandContainer(world, batcher, ox, oz);
    for (let s = 1; s <= 4; s++) {
      const cy = 0.28 + s * 6.0 + 3.0;
      addSingleDetailedContainerGeometry(batcher, s % 2 === 0 ? 'matte_black' : 'gunmetal_concrete', ox, cy, oz, 6.0, 6.0, 18.0, false);
      batcher.addBox(s % 2 === 0 ? 'ares_neon_purple' : 'ares_magenta', 6.3, 0.42, 18.2, ox, cy + 2.7, oz);
      world.eastPortData.detailedContainersCount++;
    }
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
  }

  // 3) 4 Torretas Laser Automatizadas nas 4 Esquinas do Setor Fortificado da A.R.E.S.
  const turretCoords = [
    [856, 558],
    [1134, 558],
    [856, 690],
    [1134, 690]
  ];
  for (const [tx, tz] of turretCoords) {
    batcher.addBox('matte_black', 7.5, 8.5, 7.5, tx, 4.5, tz);
    batcher.addBox('ares_neon_purple', 8.0, 0.9, 8.0, tx, 8.2, tz);
    batcher.addCylinder('gunmetal_concrete', 3.2, 3.8, 3.6, tx, 10.4, tz, 8);
    batcher.addBox('ares_magenta', 0.85, 0.85, 7.5, tx - 1.4, 11.2, tz + 3.2);
    batcher.addBox('ares_magenta', 0.85, 0.85, 7.5, tx + 1.4, 11.2, tz + 3.2);
    world.addCollider(tx, tz, 7.5, 7.5, 12.5, 0.28);
  }

  // 4) 3 Antenas Parabólicas Sci-Fi + 6 Geradores de Plasma Roxo-Neon Pulsantes
  for (const sx of [958, 995, 1032]) {
    batcher.addBox('matte_black', 5.2, 9.0, 5.2, sx, 4.78, 568);
    batcher.addCylinder('brushed_silver', 6.2, 1.4, 3.2, sx, 11.2, 568, 10, 0.35, 0);
    batcher.addCylinder('ares_magenta', 0.45, 0.45, 5.0, sx, 13.5, 569, 6);
    world.addCollider(sx, 568, 5.5, 5.5, 14.0, 0.28);
  }
  for (let g = 0; g < 6; g++) {
    const gx = 950 + g * 18;
    const gz = 678;
    batcher.addCylinder('matte_black', 2.8, 3.2, 8.5, gx, 4.5, gz, 10);
    batcher.addCylinder('ares_neon_purple', 2.4, 2.4, 5.2, gx, 4.5, gz, 10);
    batcher.addCylinder('ares_magenta', 3.1, 3.1, 0.75, gx, 4.5, gz, 10);
    world.addCollider(gx, gz, 6.0, 6.0, 9.0, 0.28);
  }
}
