import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from './BuildingGenerator.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from './MetroSystemBuilder.js';
import { getUrbanCityReliefY } from './ViaductAndReliefBuilder.js';

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

function createSubdividedTerrainSectorGeo(minX, maxX, minZ, maxZ, cellSize = 18) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const segX = Math.max(2, Math.round(w / cellSize));
  const segZ = Math.max(2, Math.round(d / cellSize));
  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, getUrbanCityReliefY(vx, vz));
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Constrói o Oceano Atlântico ESTRITAMENTE fora da terra firme (ZERO água sob a Ilha Continental ou Subsolo do Metrô!)
 * e gera as malhas subdivididas com relevo urbano contínuo na Ilha Principal e na Península Leste!
 */
export function buildOceanAndMainIsland(world) {
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.22,
    metalness: 0.08
  });

  const waterGeos = [];
  const addWaterPlate = (minX, maxX, minZ, maxZ, yLevel) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w <= 0 || d <= 0) return;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate((minX + maxX) * 0.5, yLevel, (minZ + maxZ) * 0.5);
    waterGeos.push(g);
  };

  // 1) Leito profundo ESTRITO do Rio / Canal Urbano Leste (X = 538..582, Z = -1330..+1080 em Y = -3.55)
  addWaterPlate(538, 582, -1330, 1080, -3.55);

  // 2) Leitos estreitos dos 3 Canais Estilo Santos na Praia Sul (Z = 724..1070 em Y = -0.52)
  for (const cx of [-384, -120, 252]) {
    addWaterPlate(cx - 12, cx + 12, 724, 1070, -0.52);
  }

  // 3) Placas do Oceano Atlântico ESTRITAMENTE externas à Ilha Principal (X = -1825..+540, Z = -1320..+1035)
  //    e externas à Península Leste (X = 580..1628, Z = -1320..+735) — ZERO água embaixo do continente!
  addWaterPlate(-3100, -1825, -3100, 3100, -0.45); // Oceano Oeste (além do Aeroporto)
  addWaterPlate(-1825, 540, -3100, -1320, -0.45);  // Oceano Norte Oeste (além das Falésias do Subúrbio)
  addWaterPlate(540, 580, -3100, -1325, -0.45);    // Foz Norte Externa do Rio
  addWaterPlate(580, 3100, -3100, -1320, -0.45);   // Oceano Nordeste
  addWaterPlate(1628, 3100, -1320, 3100, -0.45);   // Oceano Extremo Leste (além do Porto)
  addWaterPlate(580, 1628, 735, 3100, -0.45);      // Baía Sudeste (ao redor da Ponte Blindada e Ilha da Prisão)
  addWaterPlate(-1825, 540, 1035, 3100, -0.45);    // Oceano Sul (além da faixa de areia da Praia Sul)
  addWaterPlate(540, 580, 1075, 3100, -0.45);      // Foz Sul Externa do Rio

  const mergedOcean = new THREE.Mesh(mergeBufferGeometries(waterGeos), oceanMat);
  for (let i = 0; i < waterGeos.length; i++) waterGeos[i].dispose();
  mergedOcean.receiveShadow = false;
  world.scene.add(mergedOcean);

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: LEGO_COLORS.asphalt,
    roughness: 0.78,
    metalness: 0.05
  });

  // 4) Ilha Continental Principal (X = -1825..+540, Z = -1320..+780):
  //    - `cutZones` reduzidos ESTRITAMENTE aos retângulos mínimos das escadas/portais (`METRO_ISLAND_CUTOUTS` + margem de 4m),
  //      preservando 100% do relevo urbano nos quarteirões e avenidas ao redor!
  const islandGeos = [];
  const cutZones = METRO_ISLAND_CUTOUTS.map((c) => ({
    minX: c.minX - 4,
    maxX: c.maxX + 4,
    minZ: c.minZ - 4,
    maxZ: c.maxZ + 4
  }));

  for (const cz of cutZones) {
    const slices = sliceRectAroundCutouts(cz, METRO_ISLAND_CUTOUTS);
    for (const r of slices) {
      const rw = r.maxX - r.minX;
      const rd = r.maxZ - r.minZ;
      if (rw <= 0.02 || rd <= 0.02) continue;
      const rcx = (r.minX + r.maxX) * 0.5;
      const rcz = (r.minZ + r.maxZ) * 0.5;
      const topY = getUrbanCityReliefY(rcx, rcz);
      islandGeos.push(makeTranslatedBox(rw, 0.5, rd, rcx, topY - 0.25, rcz));
    }
  }

  // Faixa Oeste do Aeroporto (plana, malha leve) + Malha Urbana/Subúrbio fatiada apenas nos `cutZones` mínimos (células de 14m)
  islandGeos.push(createSubdividedTerrainSectorGeo(-1825, -1040, -1320, 780, 28));
  const urbanTerrainSlices = sliceRectAroundCutouts(
    { minX: -1040, maxX: 540, minZ: -1320, maxZ: 780 },
    cutZones
  );
  for (const s of urbanTerrainSlices) {
    if (s.maxX - s.minX <= 0.05 || s.maxZ - s.minZ <= 0.05) continue;
    islandGeos.push(createSubdividedTerrainSectorGeo(s.minX, s.maxX, s.minZ, s.maxZ, 14));
  }

  // Saias costeiras de concreto/rocha nas bordas externas da Ilha Principal (evita frestas nas falésias/margens)
  islandGeos.push(
    makeTranslatedBox(2365, 4.5, 1.5, -642.5, -2.25, -1319.25),
    makeTranslatedBox(2365, 4.5, 1.5, -642.5, -2.25, 779.25),
    makeTranslatedBox(1.5, 4.5, 2100, -1824.25, -2.25, -270),
    makeTranslatedBox(1.5, 4.5, 2100, 539.25, -2.25, -270)
  );

  const mainIsland = new THREE.Mesh(mergeBufferGeometries(islandGeos), asphaltMat);
  for (let i = 0; i < islandGeos.length; i++) islandGeos[i].dispose();
  mainIsland.receiveShadow = true;
  world.scene.add(mainIsland);

  // 5) Península Leste do Distrito Industrial & Porto (X = 580..1628, Z = -1320..+735) com Relevo Industrial (+7.0m)!
  const eastGeos = [
    createSubdividedTerrainSectorGeo(580, 1628, -1320, 735, 20),
    makeTranslatedBox(1048, 4.5, 1.5, 1104, -2.25, -1319.25),
    makeTranslatedBox(1048, 4.5, 1.5, 1104, -2.25, 734.25),
    makeTranslatedBox(1.5, 4.5, 2055, 580.75, -2.25, -292.5),
    makeTranslatedBox(1.5, 4.5, 2055, 1627.25, -2.25, -292.5)
  ];
  const eastDocks = new THREE.Mesh(mergeBufferGeometries(eastGeos), asphaltMat);
  for (let i = 0; i < eastGeos.length; i++) eastGeos[i].dispose();
  eastDocks.receiveShadow = true;
  world.scene.add(eastDocks);
}

/**
 * MALHA VIÁRIA URBANA OTIMIZADA COM ADAPTAÇÃO TOTAL AO RELEVO:
 * - Todas as faixas amarelas/brancas, faixas de pedestres, canteiros e semáforos acompanham `getUrbanCityReliefY(x, z)`!
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

  const sampleRoadY = (x, z) => getUrbanCityReliefY(x, z);

  const pushTerrainLineZ = (geos, xLine, widthX, zFrom, zTo, stepSize = 12, thickness = 0.045, yOff = 0.055) => {
    const total = zTo - zFrom;
    const steps = Math.max(1, Math.round(Math.abs(total) / stepSize));
    const dz = total / steps;
    for (let i = 0; i < steps; i++) {
      const z0 = zFrom + i * dz;
      const z1 = z0 + dz;
      const zm = (z0 + z1) * 0.5;
      const y0 = sampleRoadY(xLine, z0) + yOff;
      const y1 = sampleRoadY(xLine, z1) + yOff;
      const ym = (y0 + y1) * 0.5;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.004) {
        geos.push(makeTranslatedBox(widthX, thickness, Math.abs(dz) + 0.04, xLine, ym, zm));
      } else {
        const segLen = Math.hypot(dz, dy) + 0.08;
        const g = new THREE.BoxGeometry(widthX, thickness, segLen);
        g.rotateX(-Math.atan2(dy, dz));
        g.translate(xLine, ym, zm);
        geos.push(g);
      }
    }
  };

  const pushTerrainLineX = (geos, zLine, depthZ, xFrom, xTo, stepSize = 12, thickness = 0.045, yOff = 0.055) => {
    const total = xTo - xFrom;
    const steps = Math.max(1, Math.round(Math.abs(total) / stepSize));
    const dx = total / steps;
    for (let i = 0; i < steps; i++) {
      const x0 = xFrom + i * dx;
      const x1 = x0 + dx;
      const xm = (x0 + x1) * 0.5;
      const y0 = sampleRoadY(x0, zLine) + yOff;
      const y1 = sampleRoadY(x1, zLine) + yOff;
      const ym = (y0 + y1) * 0.5;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.004) {
        geos.push(makeTranslatedBox(Math.abs(dx) + 0.04, thickness, depthZ, xm, ym, zLine));
      } else {
        const segLen = Math.hypot(dx, dy) + 0.08;
        const g = new THREE.BoxGeometry(segLen, thickness, depthZ);
        g.rotateZ(Math.atan2(dy, dx));
        g.translate(xm, ym, zLine);
        geos.push(g);
      }
    }
  };

  // Avenidas Norte-Sul (28m de largura, de Z = -1312 até a Avenida Beira-Mar Z = 710 — 100% contínuas!)
  for (const ax of mainAvenuesX) {
    world.mapRoads.push({ x: ax, z: -301, w: 28, d: 2022, isMain: true });

    if (ax !== 0) {
      pushTerrainLineZ(yellowGeos, ax - 0.5, 0.45, -1312, 710, 12);
      pushTerrainLineZ(yellowGeos, ax + 0.5, 0.45, -1312, 710, 12);
    } else {
      // Na Av. Central X = 0, desenha as faixas fora da rampa central do Viaduto 1 (Z = -374..-286)
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, -1312, -388, 12);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, -1312, -388, 12);
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, -280, 710, 12);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, -280, 710, 12);
    }

    // Canteiros centrais arborizados acompanhando a inclinação da rua!
    for (const segZ of [-316, -58, 68, 556]) {
      if ((ax === 0 && (segZ === -316 || segZ === -58)) || (ax === 252 && (segZ === -58 || segZ === 556))) continue;
      pushTerrainLineZ(medianGeos, ax, 2.6, segZ - 34, segZ + 34, 12, 0.55, 0.06);
      pushTerrainLineZ(turfGeos, ax, 1.8, segZ - 32, segZ + 32, 12, 0.14, 0.36);

      const ty1 = sampleRoadY(ax, segZ - 20) + 0.38;
      const ty2 = sampleRoadY(ax, segZ + 20) + 0.38;
      world._addLegoTree(ax, ty1, segZ - 20, 1.0);
      world._addLegoTree(ax, ty2, segZ + 20, 1.0);
    }
  }

  // Avenidas Leste-Oeste (100% inteiras em Z = +134 e todas as demais!)
  for (const az of mainAvenuesZ) {
    const minX = az === 710 ? -1815 : -516;
    const maxX = az <= 134 ? 1616 : az === 710 ? 640 : 1200;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: 28, isMain: true });

    pushTerrainLineX(yellowGeos, az - 0.5, 0.45, minX + 5, 526 - 5, 12);
    pushTerrainLineX(yellowGeos, az + 0.5, 0.45, minX + 5, 526 - 5, 12);

    if (maxX > 600) {
      pushTerrainLineX(yellowGeos, az - 0.5, 0.45, 599, maxX - 5, 12);
      pushTerrainLineX(yellowGeos, az + 0.5, 0.45, 599, maxX - 5, 12);
    }
  }

  // Ruas Secundárias Norte-Sul
  for (const sx of secondaryStreetsX) {
    if (sx === -648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, -512, 12);
      world.mapRoads.push({ x: sx, z: 562, w: 24, d: 296, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, 414, 710, 12);
    } else if (sx === 648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, -512, 12);
    } else {
      world.mapRoads.push({ x: sx, z: -301, w: 24, d: 2022, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, 710, 12);
    }
  }

  // Avenidas Táticas Norte-Sul do Domínio Industrial Leste
  for (const ix of [600, 768, 964, 1160, 1344, 1524]) {
    const minZ = -1312;
    const maxZ = 134;
    const d = maxZ - minZ;
    const cz = (minZ + maxZ) * 0.5;
    world.mapRoads.push({ x: ix, z: cz, w: 24, d, isMain: false });
    pushTerrainLineZ(whiteGeos, ix, 0.35, minZ, maxZ, 16);
  }

  // Ruas Secundárias Leste-Oeste
  for (const sz of secondaryStreetsZ) {
    const minX = -648;
    const maxX = sz >= -1172 && sz <= -512 ? 1616 : 526;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: sz, w: roadW, d: 24, isMain: false });

    pushTerrainLineX(whiteGeos, sz, 0.35, minX + 6, 520, 12);
    if (maxX > 600) {
      pushTerrainLineX(whiteGeos, sz, 0.35, 600, maxX - 6, 16);
    }
  }

  // Faixas de Pedestres e Semáforos 3D nos cruzamentos principais do Centro (adaptados à cota de cada cruzamento!)
  for (const ix of [-384, -252, -120, 120, 252, 384]) {
    for (const iz of [-382, -250, -117, 0, 134]) {
      for (let s = -10; s <= 10; s += 2.5) {
        const yn = sampleRoadY(ix + s, iz - 16.0) + 0.055;
        const ys = sampleRoadY(ix + s, iz + 16.0) + 0.055;
        whiteGeos.push(
          makeTranslatedBox(1.2, 0.045, 4.2, ix + s, yn, iz - 16.0),
          makeTranslatedBox(1.2, 0.045, 4.2, ix + s, ys, iz + 16.0)
        );
      }

      const tx = ix + 15.2;
      const tz = iz + 15.2;
      const baseTY = sampleRoadY(tx, tz) + 0.28;
      poleGeos.push(
        makeTranslatedBox(0.38, 6.2, 0.38, tx, baseTY + 3.1, tz),
        makeTranslatedBox(3.8, 0.24, 0.24, tx - 1.8, baseTY + 5.9, tz),
        makeTranslatedBox(0.55, 1.3, 0.55, tx - 3.2, baseTY + 5.6, tz)
      );
    }
  }

  const buildMerged = (geos, mat, receiveShadow = false) => {
    const m = new THREE.Mesh(mergeBufferGeometries(geos), mat);
    for (let i = 0; i < geos.length; i++) geos[i].dispose();
    m.receiveShadow = receiveShadow;
    return m;
  };

  const yellowMesh = buildMerged(
    yellowGeos,
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    })
  );
  const whiteMesh = buildMerged(
    whiteGeos,
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    })
  );
  const medianMesh = buildMerged(
    medianGeos,
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.concrete, roughness: 0.5 }),
    true
  );
  const turfMesh = buildMerged(
    turfGeos,
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.5 }),
    true
  );
  const poleMesh = buildMerged(poleGeos, getLegoMaterial(LEGO_COLORS.charcoal));

  world.scene.add(yellowMesh, whiteMesh, medianMesh, turfMesh, poleMesh);
}
