import * as THREE from 'three';
import {
  LEGO_COLORS,
  createLegoBrick
} from '../../../materials/LegoMaterials.js';
import { BUILDING_STYLE_KEYS } from '../../BuildingGenerator.js';
import { getMetroCutoutFloorY } from '../../MetroSystemBuilder.js';
import { buildLegoCustomsGarage } from '../../StreetCustomGarage.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  URBAN_GRID_LINES_X,
  URBAN_GRID_LINES_Z,
  ws
} from '../../core/WorldLayoutScale.js';

function resolveScaledBlockInnerBounds(designX, designZ, fallbackW, fallbackD, setback = 2.5) {
  let westLine = null;
  let eastLine = null;
  for (let i = 0; i < URBAN_GRID_LINES_X.length; i++) {
    const ln = URBAN_GRID_LINES_X[i];
    if (ln.designCoord < designX) westLine = ln;
    if (eastLine === null && ln.designCoord > designX) eastLine = ln;
  }

  let northLine = null;
  let southLine = null;
  for (let i = 0; i < URBAN_GRID_LINES_Z.length; i++) {
    const ln = URBAN_GRID_LINES_Z[i];
    if (ln.designCoord < designZ) northLine = ln;
    if (southLine === null && ln.designCoord > designZ) southLine = ln;
  }

  const minX = westLine
    ? westLine.coord + westLine.halfWidth + ROAD.sidewalk + setback
    : ws(designX) - fallbackW * 0.5 + 5;
  const maxX = eastLine
    ? eastLine.coord - eastLine.halfWidth - ROAD.sidewalk - setback
    : ws(designX) + fallbackW * 0.5 - 5;
  const minZ = northLine
    ? northLine.coord + northLine.halfWidth + ROAD.sidewalk + setback
    : ws(designZ) - fallbackD * 0.5 + 5;
  const maxZ = southLine
    ? southLine.coord - southLine.halfWidth - ROAD.sidewalk - setback
    : ws(designZ) + fallbackD * 0.5 - 5;

  return { minX, maxX, minZ, maxZ };
}

/**
 * QUARTEIRÕES DO CENTRO, TIMES SQUARE & TRANSIÇÃO NORTE (5 LAYOUTS DE QUADRA URBANA + FECHAMENTO PERFEITO DA CALÇADA)
 */
export function buildDowntownSkyscrapersAndTransitionBlocks(world) {
  const downtownGrid = [
    // Fileira Norte do Centro (Z = -316, D = 104, entre as avenidas Z = -382 e Z = -250)
    { x: -450, z: -316, w: 104, d: 104, layout: 0, baseH: 92 },
    { x: -318, z: -316, w: 104, d: 104, layout: 2, baseH: 118 },
    { x: -186, z: -316, w: 104, d: 104, layout: 1, baseH: 148 },
    { x: -60,  z: -316, w: 92,  d: 104, layout: 3, baseH: 112 },
    { x: 60,   z: -316, w: 92,  d: 104, layout: 0, baseH: 116 },
    { x: 186,  z: -316, w: 104, d: 104, layout: 2, baseH: 126 },
    { x: 318,  z: -316, w: 104, d: 104, layout: 3, baseH: 104 },
    { x: 450,  z: -316, w: 104, d: 104, layout: 0, baseH: 88 },

    // Fileira do Super Banco & Torre dos Heróis (Z = -180, D = 104)
    { x: -450, z: -180, w: 104, d: 104, layout: 3, baseH: 102 },
    { x: -186, z: -180, w: 104, d: 104, layout: 4, baseH: 138 },
    { x: 186,  z: -180, w: 104, d: 104, layout: 1, baseH: 162 },
    { x: 318,  z: -180, w: 104, d: 104, layout: 2, baseH: 128 },
    { x: 450,  z: -180, w: 104, d: 104, layout: 0, baseH: 96 },

    // Fileira Central Times Square (Z = -58, D = 90, entre as avenidas Z = -117 e Z = 0)
    { x: -450, z: -58,  w: 104, d: 90,  layout: 2, baseH: 98 },
    { x: -318, z: -58,  w: 104, d: 90,  layout: 4, baseH: 132 },
    { x: -186, z: -58,  w: 104, d: 90,  layout: 1, baseH: 156 },
    { x: -60,  z: -58,  w: 92,  d: 90,  layout: 4, baseH: 142 },
    { x: 60,   z: -58,  w: 92,  d: 90,  layout: 4, baseH: 144 },
    { x: 186,  z: -58,  w: 104, d: 90,  layout: 0, baseH: 134 },
    { x: 318,  z: -58,  w: 104, d: 90,  layout: 4, baseH: 124 },
    { x: 450,  z: -58,  w: 104, d: 90,  layout: 3, baseH: 94 },

    // Fileira Sul do Centro / Frente para o Parque Central (Z = +68, D = 104)
    { x: -450, z: 68,   w: 104, d: 104, layout: 0, baseH: 90 },
    { x: -318, z: 68,   w: 104, d: 104, layout: 3, baseH: 115 },
    { x: -186, z: 68,   w: 104, d: 104, layout: 2, baseH: 128 },
    { x: -60,  z: 68,   w: 92,  d: 104, layout: 3, baseH: 118 },
    { x: 60,   z: 68,   w: 92,  d: 104, layout: 1, baseH: 150 },
    { x: 186,  z: 68,   w: 104, d: 104, layout: 2, baseH: 122 },
    { x: 318,  z: 68,   w: 104, d: 104, layout: 0, baseH: 108 },
    { x: 450,  z: 68,   w: 104, d: 104, layout: 3, baseH: 92 }
  ];

  downtownGrid.forEach((blk, idx) => {
    buildUrbanDowntownBlock(world, blk.x, blk.z, blk.w, blk.d, blk.layout, blk.baseH, idx + 1);
  });

  // TRANSIÇÃO CENTRO NORTE (Z = -448): Quarteirões de Prédios Médios (30m a 48m) + Oficina LEGO CUSTOMS em tx === 60!
  const transColsX = [-450, -318, -186, -60, 60, 186, 318, 450];
  transColsX.forEach((tx, idx) => {
    const tw = Math.abs(tx) === 60 ? 92 : 104;
    const td = 96;
    if (tx === 60) {
      buildLegoCustomsGarage(world, 60, -448, tw, td);
      return;
    }
    const innerW = tw - 10;
    const innerD = td - 10;
    const lotW = (innerW - 6) * 0.5;
    const s1 = BUILDING_STYLE_KEYS[(idx * 2) % BUILDING_STYLE_KEYS.length];
    const s2 = BUILDING_STYLE_KEYS[(idx * 2 + 3) % BUILDING_STYLE_KEYS.length];

    if (!IS_SCALED_WORLD) {
      world._addCityBlockSidewalk(tx, -448, tw, td, LEGO_COLORS.sidewalk);
      world.createDetailedBuilding(tx - (lotW + 6) * 0.5, -448, lotW, 34 + (idx % 3) * 5, innerD, s1, {
        seed: idx * 17 + 1
      });
      world.createDetailedBuilding(tx + (lotW + 6) * 0.5, -448, lotW, 28 + ((idx + 1) % 3) * 5, innerD, s2, {
        seed: idx * 17 + 2
      });
      const treeTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, -448) : 0;
      world._addLegoTree(tx, treeTY + 0.3, -448, 1.15);
      return;
    }

    const tBlk = resolveScaledBlockInnerBounds(tx, -448, tw, td, 2.5);
    const zSouthEdge = tBlk.maxZ - innerD * 0.5;
    const xWestLot = tBlk.minX + lotW * 0.5;
    const xEastLot = tBlk.maxX - lotW * 0.5;
    world.createDetailedBuilding(xWestLot, zSouthEdge, lotW, 34 + (idx % 3) * 5, innerD, s1, {
      seed: idx * 17 + 1
    });
    world.createDetailedBuilding(xEastLot, zSouthEdge, lotW, 28 + ((idx + 1) % 3) * 5, innerD, s2, {
      seed: idx * 17 + 2
    });
    const midX = (tBlk.minX + tBlk.maxX) * 0.5;
    const treeZ = tBlk.maxZ - 8;
    if (getMetroCutoutFloorY(midX, treeZ) === null) {
      const treeTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(midX, treeZ) : 0;
      world._addLegoTree(midX, treeTY + 0.04, treeZ, 1.15);
    }
  });
}

/**
 * Constrói um Quarteirão Urbano do Centro garantindo FECHAMENTO PERFEITO DA CALÇADA:
 * - Em 1x: calçada externa S = 5 nos 4 lados -> Borda edificável exata: innerW = W - 10, innerD = D - 10.
 * - Em 3x: `UrbanSidewalkAndBlockBuilder` já cria as calçadas de 10m (+0.18m) e o miolo (+0.14m);
 *   os arranha-céus mantêm largura/profundidade/altura 1x e ancoram-se nas bordas voltadas às avenidas!
 */
export function buildUrbanDowntownBlock(world, bx, bz, W, D, layoutType, mainHeight, seed) {
  const S = 5;
  const innerW = W - S * 2;
  const innerD = D - S * 2;
  const pickStyle = (offset) => BUILDING_STYLE_KEYS[(seed * 3 + offset) % BUILDING_STYLE_KEYS.length];

  if (!IS_SCALED_WORLD) {
    world._addCityBlockSidewalk(bx, bz, W, D, LEGO_COLORS.sidewalk);

    world.downtownBlockLayouts.push({
      x: bx,
      z: bz,
      W,
      D,
      innerW,
      innerD,
      layoutType
    });

    if (layoutType === 0) {
      // MODELO 1: QUADRA DENSA DE 6 EDIFÍCIOS ENCOSTADOS
      const alleyD = 6;
      const rowD = (innerD - alleyD) * 0.5;
      const w1 = Math.round(innerW * 0.34);
      const w2 = Math.round(innerW * 0.32);
      const w3 = innerW - w1 - w2;

      const x1 = bx - innerW * 0.5 + w1 * 0.5;
      const x2 = bx - innerW * 0.5 + w1 + w2 * 0.5;
      const x3 = bx + innerW * 0.5 - w3 * 0.5;
      const zNorth = bz - innerD * 0.5 + rowD * 0.5;
      const zSouth = bz + innerD * 0.5 - rowD * 0.5;

      world.createDetailedBuilding(x1, zNorth, w1, mainHeight, rowD, pickStyle(0), { seed: seed * 11 + 1 });
      world.createDetailedBuilding(x2, zNorth, w2, Math.max(48, mainHeight - 36), rowD, pickStyle(1), { seed: seed * 11 + 2 });
      world.createDetailedBuilding(x3, zNorth, w3, Math.max(54, mainHeight - 22), rowD, pickStyle(2), { seed: seed * 11 + 3 });

      world.createDetailedBuilding(x1, zSouth, w1, Math.max(52, mainHeight - 28), rowD, pickStyle(3), { seed: seed * 11 + 4 });
      world.createDetailedBuilding(x2, zSouth, w2, Math.max(64, mainHeight - 12), rowD, pickStyle(4), { seed: seed * 11 + 5 });
      world.createDetailedBuilding(x3, zSouth, w3, Math.max(46, mainHeight - 38), rowD, pickStyle(5), { seed: seed * 11 + 6 });
    } else if (layoutType === 1) {
      // MODELO 2: ARRANHA-CÉU ESTILO EMPIRE STATE / PODIUM
      world.createDetailedBuilding(bx, bz, innerW, 20, innerD, pickStyle(0), {
        rooftop: true,
        seed: seed * 13 + 1
      });

      const s1W = Math.round(innerW * 0.68);
      const s1D = Math.round(innerD * 0.68);
      const h1 = Math.round(mainHeight * 0.64);
      world.createDetailedBuilding(bx, bz, s1W, h1, s1D, pickStyle(1), {
        groundFloor: false,
        rooftop: true,
        registerMap: false,
        seed: seed * 13 + 2
      });

      const s2W = Math.round(innerW * 0.46);
      const s2D = Math.round(innerD * 0.46);
      const h2 = Math.round(mainHeight * 0.86);
      world.createDetailedBuilding(bx, bz, s2W, h2, s2D, pickStyle(1), {
        groundFloor: false,
        rooftop: true,
        registerMap: false,
        seed: seed * 13 + 3
      });

      const s3W = Math.round(innerW * 0.28);
      const s3D = Math.round(innerD * 0.28);
      world.createDetailedBuilding(bx, bz, s3W, mainHeight, s3D, pickStyle(2), {
        groundFloor: false,
        rooftop: true,
        spire: true,
        spireHeight: 24,
        seed: seed * 13 + 4
      });
    } else if (layoutType === 2) {
      // MODELO 3: QUADRA DE 4 TORRES COM BECO EM CRUZ
      const alley = 6;
      const lotW = (innerW - alley) * 0.5;
      const lotD = (innerD - alley) * 0.5;
      const offX = (lotW + alley) * 0.5;
      const offZ = (lotD + alley) * 0.5;

      const corners = [
        [-offX, -offZ, mainHeight, pickStyle(0)],
        [offX, -offZ, Math.max(56, mainHeight - 24), pickStyle(1)],
        [-offX, offZ, Math.max(62, mainHeight - 16), pickStyle(2)],
        [offX, offZ, Math.max(50, mainHeight - 34), pickStyle(3)]
      ];
      corners.forEach(([dx, dz, ch, st], cIdx) => {
        world.createDetailedBuilding(bx + dx, bz + dz, lotW, ch, lotD, st, {
          seed: seed * 19 + cIdx
        });
      });

      const alleyTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(bx, bz) : 0;
      const dumpster = createLegoBrick(2.4, 1.6, 1.8, LEGO_COLORS.green, { studStep: 0.8, castShadow: false });
      dumpster.position.set(bx - 1.5, alleyTY + 0.28 + 0.8, bz);
      const crate = createLegoBrick(1.6, 1.4, 1.6, LEGO_COLORS.brown, { studStep: 0.8, castShadow: false });
      crate.position.set(bx + 1.5, alleyTY + 0.28 + 0.7, bz);
      world.scene.add(dumpster, crate);
    } else if (layoutType === 3) {
      // MODELO 4: COMPLEXO CORPORATIVO EM "U" COM PRAÇA FRONTAL
      const backD = Math.round(innerD * 0.38);
      const wingW = Math.round(innerW * 0.28);
      const wingD = innerD - backD;

      world.createDetailedBuilding(
        bx,
        bz - innerD * 0.5 + backD * 0.5,
        innerW,
        mainHeight,
        backD,
        pickStyle(0),
        { seed: seed * 23 + 1 }
      );

      world.createDetailedBuilding(
        bx - innerW * 0.5 + wingW * 0.5,
        bz - innerD * 0.5 + backD + wingD * 0.5,
        wingW,
        Math.max(54, mainHeight - 28),
        wingD,
        pickStyle(1),
        { seed: seed * 23 + 2 }
      );

      world.createDetailedBuilding(
        bx + innerW * 0.5 - wingW * 0.5,
        bz - innerD * 0.5 + backD + wingD * 0.5,
        wingW,
        Math.max(54, mainHeight - 28),
        wingD,
        pickStyle(1),
        { seed: seed * 23 + 3 }
      );

      const plazaZ = bz + innerD * 0.5 - wingD * 0.5;
      const plazaTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(bx, plazaZ) : 0;
      const fountainBase = createLegoBrick(9.5, 0.9, 9.5, LEGO_COLORS.lightGrey, { studStep: 1.5 });
      fountainBase.position.set(bx, plazaTY + 0.28 + 0.45, plazaZ);
      const fountainWater = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 0.95, 7.5),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      fountainWater.position.set(bx, plazaTY + 0.28 + 0.5, plazaZ);
      const statue = createLegoBrick(2.2, 5.2, 2.2, LEGO_COLORS.gold, { metalness: 0.7, roughness: 0.15 });
      statue.position.set(bx, plazaTY + 0.28 + 2.6, plazaZ);
      world.scene.add(fountainBase, fountainWater, statue);
      world.addCollider(bx, plazaZ, 9.5, 9.5, plazaTY + 4.5, plazaTY + 0.28);

      for (const dxTree of [-11, 11]) {
        const txTree = bx + dxTree;
        const tzTree = plazaZ + 6;
        if (getMetroCutoutFloorY(txTree, tzTree) === null) {
          world._addLegoTree(txTree, 0.3, tzTree, 1.05);
        }
      }
    } else {
      // MODELO 5: QUADRA TIMES SQUARE (NEON & TELÕES COLORIDOS)
      const alley = 4;
      const lotW = (innerW - alley) * 0.5;
      const lotD = (innerD - alley) * 0.5;
      const offX = (lotW + alley) * 0.5;
      const offZ = (lotD + alley) * 0.5;

      const tsBuildings = [
        [-offX, -offZ, mainHeight, 'black_granite_gold'],
        [offX, -offZ, Math.max(66, mainHeight - 18), 'sapphire_glass'],
        [-offX, offZ, Math.max(72, mainHeight - 12), 'cyan_modern'],
        [offX, offZ, Math.max(60, mainHeight - 24), 'silver_corporate']
      ];
      tsBuildings.forEach(([dx, dz, th, st], tIdx) => {
        world.createDetailedBuilding(bx + dx, bz + dz, lotW, th, lotD, st, {
          seed: seed * 29 + tIdx
        });
      });

      const neonPalette = [0xef4444, 0x00f0ff, 0xfacc15, 0xec4899, 0x22c55e];
      for (let b = 0; b < 4; b++) {
        const nColor = neonPalette[(seed + b) % neonPalette.length];
        const nMat = new THREE.MeshBasicMaterial({ color: nColor });
        const screenZ = b < 2 ? bz - innerD * 0.5 - 0.45 : bz + innerD * 0.5 + 0.45;
        const screenX = b % 2 === 0 ? bx - offX : bx + offX;
        const screenTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(screenX, screenZ) : 0;
        const screen = new THREE.Mesh(new THREE.BoxGeometry(lotW * 0.76, 9.5, 0.6), nMat);
        screen.position.set(screenX, screenTY + 16 + (b % 2) * 11, screenZ);
        world.scene.add(screen);
      }
    }
    return;
  }

  // ==========================================================================
  // MODO ESCALADO (3x): Ancoragem nas bordas das calçadas de 10m (tamanhos 1x!)
  // ==========================================================================
  const blk = resolveScaledBlockInnerBounds(bx, bz, W, D, 2.5);
  const cxMid = (blk.minX + blk.maxX) * 0.5;
  const czMid = (blk.minZ + blk.maxZ) * 0.5;

  world.downtownBlockLayouts.push({
    x: cxMid,
    z: czMid,
    W: blk.maxX - blk.minX,
    D: blk.maxZ - blk.minZ,
    innerW,
    innerD,
    layoutType
  });

  if (layoutType === 0) {
    const alleyD = 6;
    const rowD = (innerD - alleyD) * 0.5;
    const w1 = Math.round(innerW * 0.34);
    const w2 = Math.round(innerW * 0.32);
    const w3 = innerW - w1 - w2;

    const x1 = blk.minX + w1 * 0.5;
    const x2 = cxMid;
    const x3 = blk.maxX - w3 * 0.5;
    const zNorth = blk.minZ + rowD * 0.5;
    const zSouth = blk.maxZ - rowD * 0.5;

    world.createDetailedBuilding(x1, zNorth, w1, mainHeight, rowD, pickStyle(0), { seed: seed * 11 + 1 });
    world.createDetailedBuilding(x2, zNorth, w2, Math.max(48, mainHeight - 36), rowD, pickStyle(1), { seed: seed * 11 + 2 });
    world.createDetailedBuilding(x3, zNorth, w3, Math.max(54, mainHeight - 22), rowD, pickStyle(2), { seed: seed * 11 + 3 });

    world.createDetailedBuilding(x1, zSouth, w1, Math.max(52, mainHeight - 28), rowD, pickStyle(3), { seed: seed * 11 + 4 });
    world.createDetailedBuilding(x2, zSouth, w2, Math.max(64, mainHeight - 12), rowD, pickStyle(4), { seed: seed * 11 + 5 });
    world.createDetailedBuilding(x3, zSouth, w3, Math.max(46, mainHeight - 38), rowD, pickStyle(5), { seed: seed * 11 + 6 });
  } else if (layoutType === 1) {
    // Conjunto Empire State concêntrico ancorado na esquina principal voltada ao coração financeiro
    const empX = bx < 0 ? blk.maxX - innerW * 0.5 : blk.minX + innerW * 0.5;
    const empZ = bz < 0 ? blk.maxZ - innerD * 0.5 : blk.minZ + innerD * 0.5;

    world.createDetailedBuilding(empX, empZ, innerW, 20, innerD, pickStyle(0), {
      rooftop: true,
      seed: seed * 13 + 1
    });

    const s1W = Math.round(innerW * 0.68);
    const s1D = Math.round(innerD * 0.68);
    const h1 = Math.round(mainHeight * 0.64);
    world.createDetailedBuilding(empX, empZ, s1W, h1, s1D, pickStyle(1), {
      groundFloor: false,
      rooftop: true,
      registerMap: false,
      seed: seed * 13 + 2
    });

    const s2W = Math.round(innerW * 0.46);
    const s2D = Math.round(innerD * 0.46);
    const h2 = Math.round(mainHeight * 0.86);
    world.createDetailedBuilding(empX, empZ, s2W, h2, s2D, pickStyle(1), {
      groundFloor: false,
      rooftop: true,
      registerMap: false,
      seed: seed * 13 + 3
    });

    const s3W = Math.round(innerW * 0.28);
    const s3D = Math.round(innerD * 0.28);
    world.createDetailedBuilding(empX, empZ, s3W, mainHeight, s3D, pickStyle(2), {
      groundFloor: false,
      rooftop: true,
      spire: true,
      spireHeight: 24,
      seed: seed * 13 + 4
    });
  } else if (layoutType === 2) {
    const alley = 6;
    const lotW = (innerW - alley) * 0.5;
    const lotD = (innerD - alley) * 0.5;

    const corners = [
      [blk.minX + lotW * 0.5, blk.minZ + lotD * 0.5, mainHeight, pickStyle(0)],
      [blk.maxX - lotW * 0.5, blk.minZ + lotD * 0.5, Math.max(56, mainHeight - 24), pickStyle(1)],
      [blk.minX + lotW * 0.5, blk.maxZ - lotD * 0.5, Math.max(62, mainHeight - 16), pickStyle(2)],
      [blk.maxX - lotW * 0.5, blk.maxZ - lotD * 0.5, Math.max(50, mainHeight - 34), pickStyle(3)]
    ];
    corners.forEach(([tx, tz, ch, st], cIdx) => {
      world.createDetailedBuilding(tx, tz, lotW, ch, lotD, st, {
        seed: seed * 19 + cIdx
      });
    });

    const propX = blk.minX + lotW + 3.0;
    const propZ = blk.minZ + lotD * 0.5;
    const alleyTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(propX, propZ) : 0;
    const dumpster = createLegoBrick(2.4, 1.6, 1.8, LEGO_COLORS.green, { studStep: 0.8, castShadow: false });
    dumpster.position.set(propX - 1.5, alleyTY + 0.02 + 0.8, propZ);
    const crate = createLegoBrick(1.6, 1.4, 1.6, LEGO_COLORS.brown, { studStep: 0.8, castShadow: false });
    crate.position.set(propX + 1.5, alleyTY + 0.02 + 0.7, propZ);
    world.scene.add(dumpster, crate);
  } else if (layoutType === 3) {
    // Complexo Corporativo em "U" ancorado de frente para a Avenida Sul do quarteirão
    const backD = Math.round(innerD * 0.38);
    const wingW = Math.round(innerW * 0.28);
    const wingD = innerD - backD;
    const uFrontZ = blk.maxZ;
    const wingMidZ = uFrontZ - wingD * 0.5;
    const backMidZ = uFrontZ - wingD - backD * 0.5;

    world.createDetailedBuilding(
      cxMid,
      backMidZ,
      innerW,
      mainHeight,
      backD,
      pickStyle(0),
      { seed: seed * 23 + 1 }
    );

    world.createDetailedBuilding(
      cxMid - innerW * 0.5 + wingW * 0.5,
      wingMidZ,
      wingW,
      Math.max(54, mainHeight - 28),
      wingD,
      pickStyle(1),
      { seed: seed * 23 + 2 }
    );

    world.createDetailedBuilding(
      cxMid + innerW * 0.5 - wingW * 0.5,
      wingMidZ,
      wingW,
      Math.max(54, mainHeight - 28),
      wingD,
      pickStyle(1),
      { seed: seed * 23 + 3 }
    );

    const plazaZ = wingMidZ;
    if (getMetroCutoutFloorY(cxMid, plazaZ) === null) {
      const plazaTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cxMid, plazaZ) : 0;
      const fountainBase = createLegoBrick(9.5, 0.9, 9.5, LEGO_COLORS.lightGrey, { studStep: 1.5 });
      fountainBase.position.set(cxMid, plazaTY + 0.02 + 0.45, plazaZ);
      const fountainWater = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 0.95, 7.5),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      fountainWater.position.set(cxMid, plazaTY + 0.02 + 0.5, plazaZ);
      const statue = createLegoBrick(2.2, 5.2, 2.2, LEGO_COLORS.gold, { metalness: 0.7, roughness: 0.15 });
      statue.position.set(cxMid, plazaTY + 0.02 + 2.6, plazaZ);
      world.scene.add(fountainBase, fountainWater, statue);
      world.addCollider(cxMid, plazaZ, 9.5, 9.5, plazaTY + 4.5, plazaTY + 0.02);
    }

    for (const dxTree of [-11, 11]) {
      const txTree = cxMid + dxTree;
      const tzTree = plazaZ + 6;
      if (getMetroCutoutFloorY(txTree, tzTree) === null) {
        const treeTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(txTree, tzTree) : 0;
        world._addLegoTree(txTree, treeTY + 0.04, tzTree, 1.05);
      }
    }
  } else {
    const alley = 4;
    const lotW = (innerW - alley) * 0.5;
    const lotD = (innerD - alley) * 0.5;

    const xWest = blk.minX + lotW * 0.5;
    const xEast = blk.maxX - lotW * 0.5;
    const zNorth = blk.minZ + lotD * 0.5;
    const zSouth = blk.maxZ - lotD * 0.5;

    const tsBuildings = [
      [xWest, zNorth, mainHeight, 'black_granite_gold'],
      [xEast, zNorth, Math.max(66, mainHeight - 18), 'sapphire_glass'],
      [xWest, zSouth, Math.max(72, mainHeight - 12), 'cyan_modern'],
      [xEast, zSouth, Math.max(60, mainHeight - 24), 'silver_corporate']
    ];
    tsBuildings.forEach(([tx, tz, th, st], tIdx) => {
      world.createDetailedBuilding(tx, tz, lotW, th, lotD, st, {
        seed: seed * 29 + tIdx
      });
    });

    const neonPalette = [0xef4444, 0x00f0ff, 0xfacc15, 0xec4899, 0x22c55e];
    for (let b = 0; b < 4; b++) {
      const nColor = neonPalette[(seed + b) % neonPalette.length];
      const nMat = new THREE.MeshBasicMaterial({ color: nColor });
      const screenZ = b < 2 ? blk.minZ - 0.45 : blk.maxZ + 0.45;
      const screenX = b % 2 === 0 ? xWest : xEast;
      const screenTY = world.getTerrainHeightAt ? world.getTerrainHeightAt(screenX, screenZ) : 0;
      const screen = new THREE.Mesh(new THREE.BoxGeometry(lotW * 0.76, 9.5, 0.6), nMat);
      screen.position.set(screenX, screenTY + 16 + (b % 2) * 11, screenZ);
      world.scene.add(screen);
    }
  }
}
