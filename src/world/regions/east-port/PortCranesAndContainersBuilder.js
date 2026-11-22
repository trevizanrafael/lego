import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import {
  addCorrugatedContainerStack,
  addSingleDetailedContainerGeometry
} from './EastPortBatcherAndMaterials.js';
import { addPortCargoSemiTruck } from './CargoShipsAndDocksBuilder.js';

/**
 * 3. SELVA DE CONTÊINERES ULTRA-DENSA (40 GRANDES MACIÇOS LABIRÍNTICOS DE 5 A 8 ANDARES = 30m A 48m DE ALTURA!)
 * - Ocupação de 90% de todos os pátios do Porto (zero quadradão cinza vazio!);
 * - Cânions verticais claustrofóbicos de 36m a 48m, paredões em L, U, T e diagonal, e escadarias em degraus (1 -> 8 andares);
 * - Pontes Aéreas de Contêineres Suspensos (Y = 24m e Y = 36m) e rede contínua de Passarelas Metálicas no topo;
 * - 18 Pórticos Rolantes RTG Gigantes de 56m de altura com contêineres suspensos por cabos sobre os corredores!
 */
export function buildMassiveContainerYardBlocksAndRTGCranes(world, batcher, colorKeys) {
  const yardBlocks = [
    // SETOR 1: PÁTIO CENTRAL-OESTE COMPLETO (X = 852..1142, Z = 356..518) — 10 Maciços de 6 a 8 Andares (36m a 48m!)
    { bx: 868, bz: 386, rows: 4, bays: 3, maxFloors: 7, shape: 'L', hasRTG: true, seed: 1 },
    { bx: 922, bz: 386, rows: 4, bays: 3, maxFloors: 8, shape: 'U', hasRTG: false, seed: 2 },
    { bx: 976, bz: 386, rows: 4, bays: 3, maxFloors: 7, shape: 'T', hasRTG: true, seed: 3 },
    { bx: 1034, bz: 386, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 4 },
    { bx: 1098, bz: 386, rows: 5, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 5 },

    { bx: 868, bz: 478, rows: 4, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 6 },
    { bx: 922, bz: 478, rows: 4, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true, seed: 7 },
    { bx: 976, bz: 478, rows: 4, bays: 3, maxFloors: 6, shape: 'U', hasRTG: false, seed: 8 },
    { bx: 1034, bz: 478, rows: 5, bays: 3, maxFloors: 8, shape: 'T', hasRTG: true, seed: 9 },
    { bx: 1098, bz: 478, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: true, seed: 10 },

    // SETOR 2: PÁTIO CENTRAL-LESTE COMPLETO (X = 1180..1352, Z = 356..518) — 6 Maciços de 6 a 8 Andares (36m a 48m!)
    { bx: 1202, bz: 386, rows: 4, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 11 },
    { bx: 1258, bz: 386, rows: 5, bays: 3, maxFloors: 7, shape: 'T', hasRTG: false, seed: 12 },
    { bx: 1318, bz: 386, rows: 5, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true, seed: 13 },

    { bx: 1202, bz: 478, rows: 4, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 14 },
    { bx: 1258, bz: 478, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 15 },
    { bx: 1318, bz: 478, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 16 },

    // SETOR 3: PÁTIO SUL-LESTE (X = 1180..1352, Z = 556..692) — 6 Maciços de 6 a 8 Andares!
    { bx: 1202, bz: 586, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 17 },
    { bx: 1260, bz: 586, rows: 5, bays: 3, maxFloors: 7, shape: 'T', hasRTG: false, seed: 18 },
    { bx: 1318, bz: 586, rows: 5, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true, seed: 19 },

    { bx: 1202, bz: 658, rows: 5, bays: 2, maxFloors: 7, shape: 'L', hasRTG: false, seed: 20 },
    { bx: 1260, bz: 658, rows: 5, bays: 2, maxFloors: 8, shape: 'U', hasRTG: true, seed: 21 },
    { bx: 1318, bz: 658, rows: 5, bays: 2, maxFloors: 7, shape: 'T', hasRTG: false, seed: 22 },

    // SETOR 4: FAIXA COMPLETA DO CAIS LESTE (X = 1396..1524, Z = 158..688) — 12 Maciços Colossais de 6 a 8 Andares!
    { bx: 1424, bz: 194, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 23 },
    { bx: 1488, bz: 194, rows: 5, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 24 },
    { bx: 1424, bz: 282, rows: 5, bays: 3, maxFloors: 7, shape: 'T', hasRTG: false, seed: 25 },
    { bx: 1488, bz: 282, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 26 },

    { bx: 1424, bz: 386, rows: 5, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true, seed: 27 },
    { bx: 1488, bz: 386, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 28 },
    { bx: 1424, bz: 478, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 29 },
    { bx: 1488, bz: 478, rows: 5, bays: 3, maxFloors: 8, shape: 'T', hasRTG: true, seed: 30 },

    { bx: 1424, bz: 586, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true, seed: 31 },
    { bx: 1488, bz: 586, rows: 5, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 32 },
    { bx: 1424, bz: 658, rows: 5, bays: 2, maxFloors: 7, shape: 'L', hasRTG: false, seed: 33 },
    { bx: 1488, bz: 658, rows: 5, bays: 2, maxFloors: 8, shape: 'U', hasRTG: true, seed: 34 },

    // SETOR 5: CORREDORES LABIRÍNTICOS ENTRE OS ARMAZÉNS E CAPITANIA (X = 620..1150) — 6 Maciços de 5 a 7 Andares!
    { bx: 713, bz: 304, rows: 4, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 35 },
    { bx: 713, bz: 504, rows: 4, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 36 },
    { bx: 713, bz: 682, rows: 4, bays: 1, maxFloors: 5, shape: 'L', hasRTG: false, seed: 37 },
    { bx: 950, bz: 304, rows: 5, bays: 1, maxFloors: 7, shape: 'U', hasRTG: false, seed: 38 },
    { bx: 1054, bz: 298, rows: 3, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 39 },
    { bx: 1142, bz: 298, rows: 3, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 40 }
  ];

  world.eastPortData.yardBlocksCount = yardBlocks.length;
  let rtgCount = 0;
  const scaledBlockCenters = [];

  yardBlocks.forEach((yb, bIdx) => {
    const bx = ws(yb.bx);
    // Em 3x, recua a fileira Z=386 para ws(370)=1110 para livrar 100% a avenida principal Z = ws(402) = 1206
    const bz = IS_SCALED_WORLD && yb.bz === 386 ? ws(370) : ws(yb.bz);
    scaledBlockCenters.push({ bx, bz, rows: yb.rows, bays: yb.bays });
    const { rows, bays, maxFloors, shape, hasRTG, seed } = yb;
    const colSpacingX = 6.35;
    const baySpacingZ = 18.4;

    const bayStart = bays === 1 ? 0 : bays === 2 ? -0.5 : -1;
    const bayEnd = bays === 1 ? 0 : bays === 2 ? 0.5 : 1;

    for (let r = 0; r < rows; r++) {
      const rx = bx + (r - (rows - 1) * 0.5) * colSpacingX;
      for (let bay = bayStart; bay <= bayEnd; bay += 1) {
        const rz = bz + bay * baySpacingZ;

        let floors = maxFloors;
        if (bays >= 3 && bay === bayEnd && r === 0) {
          floors = 2;
        } else if (bays >= 3 && bay === bayEnd && r === 1) {
          floors = 4;
        } else if (bays >= 3 && bay === bayEnd && r === 2) {
          floors = 6;
        } else if (shape === 'U' && r > 0 && r < rows - 1 && bay === 0) {
          floors = Math.max(3, maxFloors - 3);
        } else if ((r + Math.round(bay) + seed) % 3 === 0) {
          floors = Math.max(5, maxFloors - 1);
        }

        addCorrugatedContainerStack(world, batcher, rx, rz, floors, false, colorKeys, seed + r * 3 + Math.round(bay) + 2);
        if (floors >= 4) world.eastPortData.fourStoryStacksCount++;
        if (floors >= 5) world.eastPortData.fiveStoryStacksCount++;
        if (floors >= 6) world.eastPortData.sixToEightStoryStacksCount++;
      }
    }

    const stairX = bx - ((rows - 1) * 0.5 + 1.0) * colSpacingX;
    const stairZ = bz + bayEnd * baySpacingZ;
    addCorrugatedContainerStack(world, batcher, stairX, stairZ, 1, false, colorKeys, seed + 19);
    if (bays >= 2) {
      addCorrugatedContainerStack(world, batcher, stairX, bz, 3, false, colorKeys, seed + 23);
      addCorrugatedContainerStack(world, batcher, stairX, bz - bayEnd * baySpacingZ, 5, false, colorKeys, seed + 29);
      world.eastPortData.fiveStoryStacksCount++;
    }

    if (shape === 'U' || shape === 'L' || shape === 'T') {
      const capZNorth = bz - (bayEnd + 0.72) * baySpacingZ;
      const capFloors = Math.max(5, maxFloors - 1);
      addCorrugatedContainerStack(world, batcher, bx, capZNorth, capFloors, true, colorKeys, seed + 31);
      world.eastPortData.fourStoryStacksCount++;
      world.eastPortData.fiveStoryStacksCount++;
      if (capFloors >= 6) world.eastPortData.sixToEightStoryStacksCount++;

      if (shape === 'U' && bays >= 2) {
        const capZSouth = bz + (bayEnd + 0.72) * baySpacingZ;
        addCorrugatedContainerStack(world, batcher, bx + 4.0, capZSouth, capFloors, true, colorKeys, seed + 37);
        world.eastPortData.fourStoryStacksCount++;
        world.eastPortData.fiveStoryStacksCount++;
      }
    }

    const blockSpanW = rows * colSpacingX + 2.4;
    for (const catFloor of [5, maxFloors]) {
      const catwalkY = 0.28 + catFloor * 6.0;
      batcher.addBox('brushed_silver', blockSpanW, 0.45, 3.8, bx, catwalkY + 0.18, bz - bayEnd * baySpacingZ);
      batcher.addBox('brushed_silver', blockSpanW, 0.45, 3.8, bx, catwalkY + 0.18, bz + bayEnd * baySpacingZ);
      batcher.addBox('brushed_silver', 3.8, 0.45, (bayEnd * 2) * baySpacingZ + 12.0, bx, catwalkY + 0.18, bz);
      world.addCollider(bx, bz - bayEnd * baySpacingZ, blockSpanW, 3.8, catwalkY + 0.45, catwalkY - 0.3);
      world.addCollider(bx, bz + bayEnd * baySpacingZ, blockSpanW, 3.8, catwalkY + 0.45, catwalkY - 0.3);
      world.addCollider(bx, bz, 3.8, (bayEnd * 2) * baySpacingZ + 12.0, catwalkY + 0.45, catwalkY - 0.3);
      world.eastPortData.rooftopCatwalksCount += 3;
    }

    if (hasRTG) {
      rtgCount++;
      _buildRTGGantryCraneOverBlock(
        world,
        batcher,
        bx,
        bz,
        blockSpanW + 8.5,
        56.0,
        colorKeys[(bIdx + 1) % colorKeys.length]
      );
    }

    if (bIdx < 12) {
      addPortCargoSemiTruck(
        world,
        batcher,
        bx + blockSpanW * 0.5 + 6.8,
        bz,
        colorKeys[(bIdx * 2) % colorKeys.length],
        false
      );
    }
  });

  world.eastPortData.rtgCranesCount = rtgCount;

  // PONTES AÉREAS DE CONTÊINERES SUSPENSOS (Y = 24m, Y = 30m e Y = 36m) & PASSARELAS AÉREAS ENTRE OS CÂNIONS!
  const rawContainerSkybridges = [
    { x: 895, y: 24.28, z: 386, rotated: true, color: 'lego_red' },
    { x: 949, y: 36.28, z: 386, rotated: true, color: 'forklift_yellow' },
    { x: 1005, y: 30.28, z: 386, rotated: true, color: 'pcc_royal' },
    { x: 1066, y: 36.28, z: 386, rotated: true, color: 'lego_orange' },
    { x: 895, y: 30.28, z: 478, rotated: true, color: 'lego_green' },
    { x: 949, y: 36.28, z: 478, rotated: true, color: 'lego_red' },
    { x: 1005, y: 24.28, z: 478, rotated: true, color: 'tactical_white' },
    { x: 1066, y: 36.28, z: 478, rotated: true, color: 'forklift_yellow' },
    { x: 868, y: 30.28, z: 432, rotated: false, color: 'lego_orange' },
    { x: 976, y: 36.28, z: 432, rotated: false, color: 'pcc_royal' },
    { x: 1098, y: 30.28, z: 432, rotated: false, color: 'lego_red' },

    { x: 1230, y: 36.28, z: 386, rotated: true, color: 'lego_orange' },
    { x: 1288, y: 30.28, z: 386, rotated: true, color: 'pcc_royal' },
    { x: 1230, y: 30.28, z: 478, rotated: true, color: 'forklift_yellow' },
    { x: 1288, y: 36.28, z: 478, rotated: true, color: 'lego_red' },
    { x: 1258, y: 36.28, z: 432, rotated: false, color: 'lego_green' },
    { x: 1230, y: 36.28, z: 586, rotated: true, color: 'lego_red' },
    { x: 1288, y: 30.28, z: 586, rotated: true, color: 'forklift_yellow' },
    { x: 1230, y: 30.28, z: 658, rotated: true, color: 'pcc_royal' },
    { x: 1288, y: 36.28, z: 658, rotated: true, color: 'lego_orange' },

    { x: 1456, y: 36.28, z: 194, rotated: true, color: 'lego_red' },
    { x: 1456, y: 30.28, z: 282, rotated: true, color: 'forklift_yellow' },
    { x: 1456, y: 36.28, z: 386, rotated: true, color: 'pcc_royal' },
    { x: 1456, y: 36.28, z: 478, rotated: true, color: 'lego_orange' },
    { x: 1456, y: 36.28, z: 586, rotated: true, color: 'lego_green' },
    { x: 1456, y: 30.28, z: 658, rotated: true, color: 'lego_red' }
  ];

  const containerSkybridges = !IS_SCALED_WORLD
    ? rawContainerSkybridges
    : rawContainerSkybridges.map((sb, idx) => {
        const blk = scaledBlockCenters[idx % 34];
        const zOff = blk.bays >= 3 ? -18.4 : -9.2;
        return {
          x: sb.rotated ? blk.bx - 6.0 : blk.bx,
          y: sb.y,
          z: sb.rotated ? blk.bz + zOff : blk.bz,
          rotated: sb.rotated,
          color: sb.color
        };
      });

  for (const sb of containerSkybridges) {
    const cw = sb.rotated ? 18.0 : 6.0;
    const cd = sb.rotated ? 6.0 : 18.0;
    const ch = 6.0;
    addSingleDetailedContainerGeometry(batcher, sb.color, sb.x, sb.y + ch * 0.5, sb.z, cw, ch, cd, sb.rotated);
    batcher.addBox('matte_black', cw + 0.6, 0.45, cd + 0.6, sb.x, sb.y - 0.15, sb.z);
    batcher.addBox('brushed_silver', cw + 0.8, 0.35, cd + 0.8, sb.x, sb.y + ch + 0.18, sb.z);
    world.addCollider(sb.x, sb.z, cw + 0.8, cd + 0.8, sb.y + ch + 0.35, sb.y);
    world.eastPortData.detailedContainersCount++;
    world.eastPortData.containerSkybridgesCount++;
    world.eastPortData.rooftopCatwalksCount++;
  }

  // Contêineres em Diagonal nos cruzamentos internos da selva
  const diagonalContainers = [
    { x: 950, z: 432, floors: 3, angle: 0.38, color: 'lego_red' },
    { x: 1065, z: 432, floors: 4, angle: -0.42, color: 'forklift_yellow' },
    { x: 1230, z: 432, floors: 3, angle: 0.35, color: 'pcc_royal' },
    { x: 1318, z: 624, floors: 4, angle: -0.36, color: 'lego_orange' },
    { x: 1456, z: 335, floors: 3, angle: 0.40, color: 'lego_green' },
    { x: 1456, z: 535, floors: 3, angle: -0.38, color: 'lego_red' }
  ];
  for (const dc of diagonalContainers) {
    const dcx = ws(dc.x);
    const dcz = IS_SCALED_WORLD
      ? ws(dc.z === 335 ? 312 : dc.z === 535 ? 512 : dc.z)
      : dc.z;
    for (let s = 0; s < dc.floors; s++) {
      const cy = 0.28 + s * 6.0 + 3.0;
      const cKey = colorKeys[(s + Math.round(dc.x)) % colorKeys.length];
      batcher.addBox(cKey, 6.0, 5.85, 18.0, dcx, cy, dcz, 0, dc.angle, 0);
      batcher.addBox('brushed_silver', 6.2, 0.35, 18.2, dcx, cy + 2.8, dcz, 0, dc.angle, 0);
      world.eastPortData.detailedContainersCount++;
    }
    world.addCollider(dcx, dcz, 11.0, 14.0, 0.28 + dc.floors * 6.0, 0.28);
  }
}

/**
 * Constrói 1 Pórtico Metálico Rolante Gigante (RTG Crane, H = 56m) em Amarelo Industrial e Cinza-Aço
 */
function _buildRTGGantryCraneOverBlock(world, batcher, cx, cz, spanW, h, suspendedColorKey) {
  const halfW = spanW * 0.5;
  const legZOff = 13.5;
  for (const sx of [-1, 1]) {
    const lx = cx + sx * halfW;
    for (const sz of [-1, 1]) {
      const lz = cz + sz * legZOff;
      batcher.addCylinder('matte_black', 1.5, 1.5, 1.3, lx, 1.5, lz, 8, 0, Math.PI / 2);
      batcher.addBox('forklift_yellow', 2.4, h, 2.4, lx, 0.28 + h * 0.5, lz);
      world.addCollider(lx, lz, 2.6, 2.6, h, 0.28);
    }
    batcher.addBox('armor_slate', 2.6, 2.4, legZOff * 2 + 2.6, lx, h - 1.2, cz);
    batcher.addBox('forklift_yellow', 2.2, 1.8, legZOff * 2 + 2.2, lx, 28.0, cz);
  }
  batcher.addBox('forklift_yellow', spanW + 4.5, 2.8, 2.6, cx, h + 1.2, cz - legZOff);
  batcher.addBox('forklift_yellow', spanW + 4.5, 2.8, 2.6, cx, h + 1.2, cz + legZOff);
  batcher.addBox('lego_orange', spanW + 4.8, 0.6, 2.8, cx, h + 2.7, cz - legZOff);
  batcher.addBox('lego_orange', spanW + 4.8, 0.6, 2.8, cx, h + 2.7, cz + legZOff);
  batcher.addBox('matte_black', 8.2, 2.4, legZOff * 2 + 3.0, cx, h + 3.0, cz);
  batcher.addBox('brushed_silver', 6.8, 1.0, 18.4, cx, h - 2.0, cz);

  const suspY = h - 6.5;
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx - 2.2, h - 3.8, cz - 5.5, 6);
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx + 2.2, h - 3.8, cz - 5.5, 6);
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx - 2.2, h - 3.8, cz + 5.5, 6);
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx + 2.2, h - 3.8, cz + 5.5, 6);
  addSingleDetailedContainerGeometry(batcher, suspendedColorKey, cx, suspY, cz, 6.0, 6.0, 18.0, false);
  world.eastPortData.detailedContainersCount++;
}

/**
 * Constrói 1 Guindaste Portuário Colossal (Portainer Crane, H = 76m — dentro de 65 a 85!)
 */
export function buildColossalPortainerCrane(world, batcher, cx, cz, suspendedColorKey, rotatedSouth = false) {
  const legSpanA = 23.0; // Vão livre de 42m entre as pernas!
  const legSpanB = 14.0;
  const boomY = 56.0;
  const apexY = 76.0;

  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      const lx = rotatedSouth ? cx + sb * legSpanB : cx + sa * legSpanA;
      const lz = rotatedSouth ? cz + sa * legSpanA : cz + sb * legSpanB;
      batcher.addBox('matte_black', 4.8, 2.4, 4.8, lx, 1.48, lz);
      batcher.addBox('lego_orange', 5.0, 0.7, 5.0, lx, 2.8, lz);
      batcher.addBox('forklift_yellow', 3.8, boomY, 3.8, lx, 0.28 + boomY * 0.5, lz);
      world.addCollider(lx, lz, 4.4, 4.4, boomY, 0.28);
    }
  }

  batcher.addBox('armor_slate', rotatedSouth ? 34 : 54, 3.2, rotatedSouth ? 54 : 34, cx, boomY, cz);
  batcher.addBox('pcc_navy', 22, 6.8, 22, cx, boomY + 4.8, cz);
  batcher.addBox('forklift_yellow', rotatedSouth ? 30 : 4.8, 20.0, rotatedSouth ? 4.8 : 30, cx, boomY + 10.0, cz);
  batcher.addBox('lego_orange', rotatedSouth ? 32 : 5.6, 2.4, rotatedSouth ? 5.6 : 32, cx, apexY, cz);
  batcher.addBox('c4_hazard_red', 1.6, 1.6, 1.6, cx, apexY + 1.8, cz);

  if (!rotatedSouth) {
    batcher.addBox('forklift_yellow', 168, 4.2, 12.0, cx + 44, boomY + 2.0, cz);
    batcher.addBox('lego_orange', 169, 0.85, 12.4, cx + 44, boomY + 4.2, cz);
    batcher.addBox('brushed_silver', 86, 0.5, 0.5, cx + 52, boomY + 11.2, cz, 0, 0, -0.21);

    const dropX = cx + 101;
    batcher.addBox('matte_black', 9.2, 2.2, 9.8, dropX, boomY - 0.8, cz);
    for (const [cxOff, czOff] of [[-2.2, -5.0], [2.2, -5.0], [-2.2, 5.0], [2.2, 5.0]]) {
      batcher.addCylinder('brushed_silver', 0.18, 0.18, 19.0, dropX + cxOff, boomY - 10.5, cz + czOff, 6);
    }
    addSingleDetailedContainerGeometry(batcher, suspendedColorKey, dropX, boomY - 23.5, cz, 6.0, 6.0, 18.0, false);
  } else {
    batcher.addBox('forklift_yellow', 12.0, 4.2, 168, cx, boomY + 2.0, cz + 44);
    batcher.addBox('lego_orange', 12.4, 0.85, 169, cx, boomY + 4.2, cz + 44);
    batcher.addBox('brushed_silver', 0.5, 0.5, 86, cx, boomY + 11.2, cz + 52, 0.21, 0, 0);

    const dropZ = IS_SCALED_WORLD ? cz + 122 : cz + 71;
    batcher.addBox('matte_black', 9.8, 2.2, 9.2, cx, boomY - 0.8, dropZ);
    for (const [cxOff, czOff] of [[-5.0, -2.2], [5.0, -2.2], [-5.0, 2.2], [5.0, 2.2]]) {
      batcher.addCylinder('brushed_silver', 0.18, 0.18, 19.0, cx + cxOff, boomY - 10.5, dropZ + czOff, 6);
    }
    addSingleDetailedContainerGeometry(batcher, suspendedColorKey, cx, boomY - 23.5, dropZ, 18.0, 6.0, 6.0, true);
  }
  world.eastPortData.detailedContainersCount++;

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: rotatedSouth ? 34 : 54,
    d: IS_SCALED_WORLD && rotatedSouth ? 48 : rotatedSouth ? 54 : 34,
    height: apexY,
    color: '#facc15',
    label: 'GUINDASTE PORTAINER'
  });
}
