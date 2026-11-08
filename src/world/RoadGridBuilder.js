import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from './BuildingGenerator.js';

/**
 * Especificação Oficial das 9 Pontes Elevadas em Arco sobre o Rio/Canal Urbano Leste (X = 526..594, vão = 68m)
 * Equação da curva suave: bridgeY = archHeight * Math.sin(((x - xStart) / (xEnd - xStart)) * Math.PI)
 */
export const RIVER_BRIDGE_SPECS = [
  { z: -776, width: 26, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_north', label: 'PONTE NORTE DO CANAL' },
  { z: -512, width: 28, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate',  label: 'PONTE FRONTEIRA SUBÚRBIO-PCC' },
  { z: -382, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate',  label: 'PONTE DA CIDADELA NORTE' },
  { z: -250, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate',  label: 'PONTE CENTRAL DO SINDICATO' },
  { z: -117, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate',  label: 'PONTE DO CENTRO FINANCEIRO' },
  { z: 0,    width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate',  label: 'PONTE MONUMENTAL LESTE-OESTE' },
  { z: 134,  width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'port_gate', label: 'PONTE DO PARQUE & PORTO' },
  { z: 402,  width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'port_gate', label: 'PONTE LOGÍSTICA DAS DOCAS' },
  { z: 712,  width: 32, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'beach',     label: 'PONTE COSTEIRA DA ORLA SUL' }
];

/**
 * Especificação Oficial dos 3 Píeres/Decks Fluviais de Madeira no Rio Urbano (Cota da Água Y = -3.5, Deck Y = -2.9)
 */
export const RIVER_PIER_SPECS = [
  {
    id: 'central_park_pier',
    bank: 'west',
    z: 268,
    lengthZ: 32,
    deckXMin: 540,
    deckXMax: 547.5,
    rampXMin: 531,
    rampXMax: 540,
    deckY: -2.9,
    label: 'DECK FLUVIAL PARQUE CENTRAL'
  },
  {
    id: 'pcc_industrial_pier',
    bank: 'east',
    z: -185,
    lengthZ: 32,
    deckXMin: 572.5,
    deckXMax: 580,
    rampXMin: 580,
    rampXMax: 589,
    deckY: -2.9,
    label: 'DOCA FLUVIAL DE FUGA (PCC)'
  },
  {
    id: 'south_beach_mouth_pier',
    bank: 'west',
    z: 845,
    lengthZ: 38,
    deckXMin: 540,
    deckXMax: 547.5,
    rampXMin: 531,
    rampXMax: 540,
    deckY: -2.9,
    label: 'MARINA DA FOZ DA PRAIA SUL'
  }
];

/**
 * Constrói o Oceano Atlântico (6200x6200) e a Base Continental Ampliada da Grande Ilha Metropolitana
 * com corte físico real de 40m de largura (X = 540..580) para o Rio/Canal Urbano Navegável!
 */
export function buildOceanAndMainIsland(world) {
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.22,
    metalness: 0.08
  });

  // Base profunda do oceano e leito aquático em Y = -3.55 (permite que o Rio Urbano tenha água em Y = -3.50 sem obstrução!)
  const deepOcean = new THREE.Mesh(new THREE.PlaneGeometry(6200, 6200), oceanMat);
  deepOcean.rotation.x = -Math.PI / 2;
  deepOcean.position.y = -3.55;
  deepOcean.receiveShadow = false;
  world.scene.add(deepOcean);

  // Placas superficiais do Oceano Atlântico em Y = -0.45 ao redor da ilha, preservando a Foz Norte/Sul do Rio (X = 540..580) em Y = -3.5!
  const outerOceanSpecs = [
    { w: 3640, d: 6200, x: -1280, z: 0 },     // Oceano Oeste + Sul da Praia + Canais de Santos (X = -3100..+540)
    { w: 2520, d: 6200, x: 1840,  z: 0 },     // Oceano Leste + Porto + Ilha da Prisão (X = 580..+3100)
    { w: 40,   d: 1775, x: 560,   z: -2212.5 }, // Oceano Extremo Norte além da Foz Norte (Z = -3100..-1325)
    { w: 40,   d: 2025, x: 560,   z: 2087.5 }   // Oceano Extremo Sul além da Foz da Praia (Z = +1075..+3100)
  ];
  for (const spec of outerOceanSpecs) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.d), oceanMat);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(spec.x, -0.45, spec.z);
    plate.receiveShadow = false;
    world.scene.add(plate);
  }

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: LEGO_COLORS.asphalt,
    roughness: 0.78,
    metalness: 0.05
  });

  // Ilha Continental Principal + Ala Oeste (X = -1825..+540, Z = -1320..+780 — termina exatamente na margem Oeste do Rio X = 540!)
  const mainIsland = new THREE.Mesh(new THREE.BoxGeometry(2365, 0.5, 2100), asphaltMat);
  mainIsland.position.set(-642.5, -0.25, -270);
  mainIsland.receiveShadow = true;
  world.scene.add(mainIsland);

  // Península Leste do Império Industrial do PCC & Porto Metropolitano (X = 580..1628, Z = -1320..+735 — começa na margem Leste do Rio X = 580!)
  const eastDocks = new THREE.Mesh(new THREE.BoxGeometry(1048, 0.5, 2055), asphaltMat);
  eastDocks.position.set(1104, -0.25, -292.5);
  eastDocks.receiveShadow = true;
  world.scene.add(eastDocks);
}

/**
 * MALHA VIÁRIA URBANA OTIMIZADA (ROAD GRID):
 * - Funde todas as faixas amarelas, brancas, faixas de pedestres, canteiros e semáforos em apenas 5 Draw Calls!
 */
export function buildUrbanRoadGridAndMedians(world) {
  const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
  const mainAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];
  const secondaryStreetsX = [-648, -516, 516, 648];
  const secondaryStreetsZ = [-1172, -1040, -908, -776, -644, -512, 556];

  const yellowGeos = [];
  const whiteGeos = [];
  const medianGeos = [];
  const turfGeos = [];
  const poleGeos = [];

  // Avenidas Norte-Sul (28m de largura, de Z = -1312 até a Avenida Beira-Mar Z = 710)
  for (const ax of mainAvenuesX) {
    world.mapRoads.push({ x: ax, z: -301, w: 28, d: 2022, isMain: true });

    if (ax !== 0) {
      yellowGeos.push(
        makeTranslatedBox(0.45, 0.04, 2022, ax - 0.5, 0.02, -301),
        makeTranslatedBox(0.45, 0.04, 2022, ax + 0.5, 0.02, -301)
      );
    }

    // Canteiros centrais arborizados apenas nas avenidas largas do Centro e Sul (Subúrbio Norte tem ruas estreitas!)
    for (const segZ of [-316, -58, 68, 556]) {
      if (ax === 0 && (segZ === -316 || segZ === -58)) continue;
      medianGeos.push(makeTranslatedBox(2.6, 0.32, 68, ax, 0.16, segZ));
      turfGeos.push(makeTranslatedBox(1.8, 0.12, 64, ax, 0.36, segZ));

      world._addLegoTree(ax, 0.38, segZ - 20, 1.0);
      world._addLegoTree(ax, 0.38, segZ + 20, 1.0);
    }
  }

  // Avenidas Leste-Oeste (divididas nos cabeceiras das Pontes do Rio X = 526..594 para que não flutuem sobre a água!)
  for (const az of mainAvenuesZ) {
    const minX = az === 710 ? -1815 : -516;
    const maxX = az <= 134 ? 1616 : az === 710 ? 640 : 1200;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: 28, isMain: true });

    // Trecho Oeste do Rio (minX até X = 526)
    const westW = 526 - minX;
    const westCX = (minX + 526) * 0.5;
    yellowGeos.push(
      makeTranslatedBox(westW - 10, 0.04, 0.45, westCX, 0.02, az - 0.5),
      makeTranslatedBox(westW - 10, 0.04, 0.45, westCX, 0.02, az + 0.5)
    );

    // Trecho Leste do Rio (X = 594 até maxX)
    if (maxX > 600) {
      const eastW = maxX - 594;
      const eastCX = (594 + maxX) * 0.5;
      yellowGeos.push(
        makeTranslatedBox(eastW - 10, 0.04, 0.45, eastCX, 0.02, az - 0.5),
        makeTranslatedBox(eastW - 10, 0.04, 0.45, eastCX, 0.02, az + 0.5)
      );
    }
  }

  // Ruas Secundárias Norte-Sul (24m de largura — sem cortar o interior da Favela nem o Rio Urbano!)
  for (const sx of secondaryStreetsX) {
    if (sx === -648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      whiteGeos.push(makeTranslatedBox(0.35, 0.04, 800, sx, 0.02, -912));
      world.mapRoads.push({ x: sx, z: 562, w: 24, d: 296, isMain: false });
      whiteGeos.push(makeTranslatedBox(0.35, 0.04, 296, sx, 0.02, 562));
    } else if (sx === 648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      whiteGeos.push(makeTranslatedBox(0.35, 0.04, 800, sx, 0.02, -912));
    } else {
      world.mapRoads.push({ x: sx, z: -301, w: 24, d: 2022, isMain: false });
      whiteGeos.push(makeTranslatedBox(0.35, 0.04, 2022, sx, 0.02, -301));
    }
  }

  // Avenidas Táticas Norte-Sul do Domínio Industrial do PCC (X = 600, 768, 964, 1160, 1344, 1524 entre Z = -1312 e Z = 134)
  for (const ix of [600, 768, 964, 1160, 1344, 1524]) {
    const minZ = -1312;
    const maxZ = 134;
    const d = maxZ - minZ;
    const cz = (minZ + maxZ) * 0.5;
    world.mapRoads.push({ x: ix, z: cz, w: 24, d, isMain: false });
    whiteGeos.push(makeTranslatedBox(0.35, 0.04, d, ix, 0.02, cz));
  }

  for (const sz of secondaryStreetsZ) {
    const minX = -648;
    const maxX = sz >= -1172 && sz <= -512 ? 1616 : 526;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: sz, w: roadW, d: 24, isMain: false });

    const westW = 526 - minX;
    const westCX = (minX + 526) * 0.5;
    whiteGeos.push(makeTranslatedBox(westW - 12, 0.04, 0.35, westCX, 0.02, sz));

    if (maxX > 600) {
      const eastW = maxX - 594;
      const eastCX = (594 + maxX) * 0.5;
      whiteGeos.push(makeTranslatedBox(eastW - 12, 0.04, 0.35, eastCX, 0.02, sz));
    }
  }

  // Faixas de Pedestres e Semáforos 3D nos cruzamentos principais do Centro (Mesclados!)
  for (const ix of [-384, -252, -120, 120, 252, 384]) {
    for (const iz of [-382, -250, -117, 0, 134]) {
      for (let s = -10; s <= 10; s += 2.5) {
        whiteGeos.push(
          makeTranslatedBox(1.2, 0.04, 4.2, ix + s, 0.025, iz - 16.0),
          makeTranslatedBox(1.2, 0.04, 4.2, ix + s, 0.025, iz + 16.0)
        );
      }

      const tx = ix + 15.2;
      const tz = iz + 15.2;
      poleGeos.push(
        makeTranslatedBox(0.38, 6.2, 0.38, tx, 0.28 + 3.1, tz),
        makeTranslatedBox(3.8, 0.24, 0.24, tx - 1.8, 0.28 + 5.9, tz),
        makeTranslatedBox(0.55, 1.3, 0.55, tx - 3.2, 0.28 + 5.6, tz)
      );
    }
  }

  const yellowMesh = new THREE.Mesh(
    mergeBufferGeometries(yellowGeos),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  const whiteMesh = new THREE.Mesh(
    mergeBufferGeometries(whiteGeos),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  );
  const medianMesh = new THREE.Mesh(
    mergeBufferGeometries(medianGeos),
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.concrete, roughness: 0.5 })
  );
  medianMesh.receiveShadow = true;

  const turfMesh = new THREE.Mesh(
    mergeBufferGeometries(turfGeos),
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.5 })
  );
  turfMesh.receiveShadow = true;

  const poleMesh = new THREE.Mesh(
    mergeBufferGeometries(poleGeos),
    getLegoMaterial(LEGO_COLORS.charcoal)
  );

  world.scene.add(yellowMesh, whiteMesh, medianMesh, turfMesh, poleMesh);
}
